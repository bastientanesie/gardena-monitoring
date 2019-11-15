# Gardena Monitoring

## Install

Generate VAPID key with [web-push](https://www.npmjs.com/package/web-push), then :

```bash
docker-compose build
cp docker-compose.override.yml.dist docker-compose.override.yml
nano docker-compose.override.yml
cp .env.dist .env
nano .env
docker-compose up -d --remove-orphans
```

## Usage

- Build : `docker-compose build`
- Start : `docker-compose up -d --remove-orphans`
- Stop : `docker-compose down --remove-orphans`
- Logs : `docker-compose logs --tail=50 --timestamps`

## Docker permissions

The app must write files inside the `./data` folder. To match a specific host user inside Docker, copy the override file and edit it with the needed user ids :

```bash
cp docker-compose.override.yml.dist docker-compose.override.yml
nano docker-compose.override.yml
```

## Documentation

- [Official Husqvarna/Gardena developer portal](https://developer.1689.cloud/)
