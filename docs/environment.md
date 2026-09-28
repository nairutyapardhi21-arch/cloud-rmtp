# Environment verification

Checked on 2026-09-28. This document intentionally contains no credentials, stream keys, or passwords. A fresh PowerShell session is required after the PATH repair.

| Component | Detection result | Installation location |
| --- | --- | --- |
| Windows | Version query was blocked by local permissions | Verify with `winver` on the desktop |
| Git | PASS — 2.55.0.windows.5 | `C:\Installed Apps\Git` |
| OBS Studio | 32.0.1 | `C:\Program Files\obs-studio` (system-managed installer location) |
| Docker Desktop / Docker Compose | PASS — Docker 29.8.0 / Compose 5.5.1; engine server 29.8.0 on `desktop-linux` | `C:\Users\pardh\AppData\Local\Programs\DockerDesktop` (existing system/user-managed installation) |
| Node.js 22 LTS / npm | PASS — Node v22.23.3 / npm 10.9.9 | `C:\Installed Apps\nodejs` |
| FFmpeg | PASS — 9.0.2 essentials build; `ffmpeg` and `ffprobe` verified | `C:\Installed Apps\ffmpeg` |
| AWS CLI | BLOCKED — official installer download completed, but the silent MSI did not complete in the managed session | Intended: `C:\Installed Apps\AWS CLI`; AWS MSI may use a system-managed location |
| Postman equivalent | Not installed; API test commands in README are the equivalent | Optional: `C:\Installed Apps\Postman` |

## Required PATH entries after installation

Add these user-level entries, then open a **new** PowerShell window:

```text
C:\Installed Apps\Git\cmd
C:\Installed Apps\nodejs
C:\Installed Apps\ffmpeg\bin
C:\Program Files\Amazon\AWSCLIV2
```

## Verification commands

```powershell
git --version
docker --version
docker compose version
node --version
npm --version
ffmpeg -version
aws --version
& 'C:\Program Files\obs-studio\bin\64bit\obs64.exe' --version
```

Observed executable paths: Git `C:\Installed Apps\Git\cmd\git.exe`; Node `C:\Installed Apps\nodejs\node.exe`; npm `C:\Installed Apps\nodejs\npm.cmd`; Docker CLI `C:\Users\pardh\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe`; OBS `C:\Program Files\obs-studio\bin\64bit\obs64.exe`.

The codebase is ready for these checks, but Docker-dependent validation remains pending until WSL/Docker starts, npm can access its registry, FFmpeg extraction finishes, and AWS authentication plus destination credentials are supplied.
