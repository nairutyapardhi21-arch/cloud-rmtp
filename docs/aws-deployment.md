# AWS EC2 deployment

This is intentionally a small, single-EC2 prototype deployment.

## 1. Create the host

1. Create a current Ubuntu LTS EC2 instance (at least `t3.medium` is a practical demo baseline).
2. Attach an IAM instance role allowing `secretsmanager:GetSecretValue` for only the three destination secrets and CloudWatch Logs writes to `/cloud-restreamer/*`.
3. In the security group, allow inbound `1935/TCP` from the OBS network, `80/TCP` for the dashboard, and `22/TCP` only from the administrator's IP. Add `443/TCP` only after configuring HTTPS. Do not expose PostgreSQL, API port 3001, nginx `/stat`, or Docker ports.
4. Use `infra/aws/ec2-bootstrap.sh` as user data or run it after SSH access.

## 2. Configure secrets

Store **the complete RTMP publish URL** for each platform as a Secrets Manager `SecretString`; for example, a YouTube secret contains `rtmp://a.rtmp.youtube.com/live2/KEY`.

Use the secret ARN or name in the dashboard's **AWS Secrets Manager reference** field. The API retrieves it only at restream-process start and never returns it from API endpoints or logs it.

## 3. Start services

```bash
cd /opt/cloud-restreamer
cp .env.example .env
# Set PUBLIC_RTMP_URL=rtmp://YOUR_EC2_PUBLIC_DNS/live and a strong POSTGRES_PASSWORD.
docker compose -f docker-compose.yml -f docker-compose.aws.yml up -d --build
curl http://127.0.0.1:3001/health
```

Ensure the EC2 role and Docker AWS logging driver can create/write the named CloudWatch log groups. If organisational policy requires pre-created groups, create `/cloud-restreamer/api` and `/cloud-restreamer/nginx` first.

## 4. CloudWatch demonstration

Open the EC2 instance's CloudWatch metrics during a test broadcast. `NetworkIn` increases with OBS ingest; `NetworkOut` increases for each enabled destination. Also show the API/nginx log groups. This distinguishes the cloud media path from a local-only simulation.

