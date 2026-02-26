import re

path = "/home/localhost8081/rowan/backend/src/server.js"

with open(path, "r") as f:
    content = f.read()

content = content.replace(
    "logger.error('FATAL: Missing required environment variables:')",
    "console.error('FATAL: Missing required environment variables:')"
)
content = content.replace(
    "missingVars.forEach(v => logger.error(",
    "missingVars.forEach(v => console.error("
)
content = content.replace(
    "logger.error('Refusing to start. See .env.example for reference.')",
    "console.error('Refusing to start. See .env.example for reference.')"
)

with open(path, "w") as f:
    f.write(content)

print("DONE")
