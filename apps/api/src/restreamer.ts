import { spawn, type ChildProcess } from 'node:child_process';
import type { PrismaClient, Destination } from '@prisma/client';
import { resolveDestinationUrl } from './secrets.js';

type ProcessRecord = { process: ChildProcess; attempts: number; stopping: boolean };
const processes = new Map<string, ProcessRecord>();
const retryDelaysMs = [2_000, 5_000, 10_000];

export class Restreamer {
  constructor(private prisma: PrismaClient, private inputBase = process.env.RTMP_INTERNAL_URL ?? 'rtmp://nginx/live') {}

  async start(streamId: string, key: string) {
    const destinations = await this.prisma.destination.findMany({ where: { streamId, enabled: true } });
    await Promise.all(destinations.map((destination) => this.startDestination(streamId, key, destination)));
  }

  private async startDestination(streamId: string, key: string, destination: Destination, attempt = 0): Promise<void> {
    if (processes.has(destination.id)) return;
    try {
      const target = await resolveDestinationUrl(destination.platform, destination.secretReference);
      await this.prisma.destination.update({ where: { id: destination.id }, data: { status: 'CONNECTING' } });
      const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'warning', '-i', `${this.inputBase}/${key}`, '-c', 'copy', '-f', 'flv', target], { stdio: ['ignore', 'ignore', 'pipe'] });
      const record: ProcessRecord = { process: child, attempts: attempt, stopping: false };
      processes.set(destination.id, record);
      child.stderr?.on('data', () => undefined); // Destination URLs/keys must never reach logs.
      child.once('spawn', async () => {
        await this.prisma.destination.update({ where: { id: destination.id }, data: { status: 'CONNECTED' } });
      });
      child.once('exit', async (code) => {
        processes.delete(destination.id);
        if (record.stopping) return;
        const nextAttempt = attempt + 1;
        const delay = retryDelaysMs[attempt];
        await this.prisma.streamEvent.create({ data: { streamId, destinationId: destination.id, type: 'DESTINATION_EXIT', message: `Restream process exited (${code ?? 'signal'}), attempt ${nextAttempt}` } });
        if (delay === undefined) {
          await this.prisma.destination.update({ where: { id: destination.id }, data: { status: 'FAILED' } });
          return;
        }
        await this.prisma.destination.update({ where: { id: destination.id }, data: { status: 'RECONNECTING' } });
        setTimeout(() => void this.startDestination(streamId, key, destination, nextAttempt), delay);
      });
    } catch (error) {
      await this.prisma.destination.update({ where: { id: destination.id }, data: { status: 'FAILED' } });
      await this.prisma.streamEvent.create({ data: { streamId, destinationId: destination.id, type: 'DESTINATION_CONFIG_ERROR', message: error instanceof Error ? error.message : 'Destination configuration error' } });
    }
  }

  async stop(streamId: string) {
    const destinations = await this.prisma.destination.findMany({ where: { streamId } });
    for (const destination of destinations) {
      const record = processes.get(destination.id);
      if (record) { record.stopping = true; record.process.kill('SIGTERM'); }
    }
    await this.prisma.destination.updateMany({ where: { streamId }, data: { status: 'DISCONNECTED' } });
  }
}

