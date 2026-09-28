import Fastify from 'fastify';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import { PrismaClient } from '@prisma/client';
import { generateStreamKey, hashStreamKey } from './crypto.js';
import { Restreamer } from './restreamer.js';

const prisma = new PrismaClient();
const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info', redact: ['req.body', 'req.query.token'] } });
const restreamer = new Restreamer(prisma);
await app.register(cors, { origin: process.env.WEB_ORIGIN?.split(',') ?? true });
await app.register(formbody);

type DestinationPayload = { platform?: string; enabled?: boolean; secretReference?: string | null };
type IngestPayload = { name?: string; token?: string };
const platforms = new Set(['YOUTUBE', 'TWITCH', 'LINKEDIN']);

const publicStream = (stream: any) => ({
  id: stream.id, name: stream.name, status: stream.status, createdAt: stream.createdAt,
  startedAt: stream.startedAt, stoppedAt: stream.stoppedAt,
  destinations: stream.destinations?.map(({ secretReference, ...destination }: any) => destination) ?? []
});

async function demoUser() {
  return prisma.user.upsert({
    where: { email: 'demo@local' }, update: {},
    create: { name: 'College Demo', email: 'demo@local' }
  });
}

async function streamOr404(id: string, reply: any) {
  const stream = await prisma.stream.findUnique({ where: { id }, include: { destinations: true } });
  if (!stream) { await reply.code(404).send({ error: 'Stream not found' }); return null; }
  return stream;
}

app.get('/health', async () => ({ status: 'ok', service: 'cloud-restreamer-api' }));

app.post('/api/streams', async (request, reply) => {
  const body = request.body as { name?: string };
  const name = body?.name?.trim();
  if (!name) return reply.code(400).send({ error: 'A stream name is required' });
  const key = generateStreamKey();
  const user = await demoUser();
  const stream = await prisma.stream.create({
    data: {
      name, userId: user.id, streamKeyHash: hashStreamKey(key),
      destinations: { create: ['YOUTUBE', 'TWITCH', 'LINKEDIN'].map(platform => ({ platform })) }
    }, include: { destinations: true }
  });
  // The one-time key is intentionally not persisted or returned by any other route.
  return reply.code(201).send({ ...publicStream(stream), ingest: { server: process.env.PUBLIC_RTMP_URL ?? 'rtmp://localhost/live', streamKey: key } });
});

app.get('/api/streams', async () => {
  const streams = await prisma.stream.findMany({ include: { destinations: true }, orderBy: { createdAt: 'desc' } });
  return streams.map(publicStream);
});

app.get('/api/streams/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const stream = await streamOr404(id, reply); return stream && publicStream(stream);
});

app.get('/api/streams/:id/status', async (request, reply) => {
  const { id } = request.params as { id: string };
  const stream = await streamOr404(id, reply);
  if (!stream) return;
  return { id: stream.id, status: stream.status, startedAt: stream.startedAt, stoppedAt: stream.stoppedAt, destinations: publicStream(stream).destinations };
});

app.post('/api/streams/:id/start', async (request, reply) => {
  const { id } = request.params as { id: string };
  const stream = await streamOr404(id, reply); if (!stream) return;
  if (!['IDLE', 'STOPPED', 'ERROR'].includes(stream.status)) return reply.code(409).send({ error: `Cannot start a ${stream.status} stream` });
  const updated = await prisma.stream.update({ where: { id }, data: { status: 'CONNECTING', stoppedAt: null } });
  await prisma.streamEvent.create({ data: { streamId: id, type: 'START_REQUESTED', message: 'Waiting for OBS to publish to RTMP ingestion.' } });
  return publicStream(updated);
});

app.post('/api/streams/:id/stop', async (request, reply) => {
  const { id } = request.params as { id: string };
  const stream = await streamOr404(id, reply); if (!stream) return;
  await prisma.stream.update({ where: { id }, data: { status: 'STOPPING' } });
  await restreamer.stop(id);
  const updated = await prisma.stream.update({ where: { id }, data: { status: 'STOPPED', stoppedAt: new Date() } });
  await prisma.streamSession.updateMany({ where: { streamId: id, endedAt: null }, data: { endedAt: new Date(), status: 'STOPPED' } });
  return publicStream(updated);
});

app.delete('/api/streams/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const stream = await streamOr404(id, reply); if (!stream) return;
  await restreamer.stop(id);
  await prisma.stream.delete({ where: { id } });
  return reply.code(204).send();
});

app.put('/api/streams/:id/destinations/:destinationId', async (request, reply) => {
  const { id, destinationId } = request.params as { id: string; destinationId: string };
  const body = request.body as DestinationPayload;
  const destination = await prisma.destination.findFirst({ where: { id: destinationId, streamId: id } });
  if (!destination) return reply.code(404).send({ error: 'Destination not found' });
  const platform = body.platform?.toUpperCase() ?? destination.platform;
  if (!platforms.has(platform)) return reply.code(400).send({ error: 'Unsupported platform' });
  // secretReference is an AWS Secrets Manager ID/ARN, never a stream key.
  const updated = await prisma.destination.update({ where: { id: destinationId }, data: { platform, enabled: body.enabled ?? destination.enabled, secretReference: body.secretReference ?? destination.secretReference } });
  const { secretReference, ...safe } = updated;
  return safe;
});

// Docker network-only callbacks from nginx-rtmp. The submitted `name` is the OBS stream key.
async function onPublish(request: any, reply: any) {
  const body = request.body as IngestPayload;
  const key = body?.name;
  if (!key) return reply.code(403).send('missing stream key');
  const stream = await prisma.stream.findUnique({ where: { streamKeyHash: hashStreamKey(key) } });
  if (!stream) return reply.code(403).send('invalid stream key');
  if (stream.status === 'STOPPING' || stream.status === 'STOPPED') return reply.code(409).send('stream stopped');
  await prisma.stream.update({ where: { id: stream.id }, data: { status: 'LIVE', startedAt: new Date(), stoppedAt: null } });
  await prisma.streamSession.create({ data: { streamId: stream.id, status: 'LIVE' } });
  await prisma.streamEvent.create({ data: { streamId: stream.id, type: 'INGEST_CONNECTED', message: 'RTMP ingestion accepted.' } });
  void restreamer.start(stream.id, key);
  return reply.code(200).send('ok');
}
app.post('/internal/ingest/publish', onPublish);

app.post('/internal/ingest/done', async (request, reply) => {
  const key = (request.body as IngestPayload)?.name;
  if (!key) return reply.code(200).send('ok');
  const stream = await prisma.stream.findUnique({ where: { streamKeyHash: hashStreamKey(key) } });
  if (stream) {
    await restreamer.stop(stream.id);
    await prisma.stream.update({ where: { id: stream.id }, data: { status: 'STOPPED', stoppedAt: new Date() } });
    await prisma.streamSession.updateMany({ where: { streamId: stream.id, endedAt: null }, data: { endedAt: new Date(), status: 'STOPPED' } });
    await prisma.streamEvent.create({ data: { streamId: stream.id, type: 'INGEST_DISCONNECTED', message: 'RTMP ingestion ended.' } });
  }
  return reply.code(200).send('ok');
});

const port = Number(process.env.API_PORT ?? 3001);
try { await app.listen({ host: '0.0.0.0', port }); }
catch (error) { app.log.error(error); process.exit(1); }
