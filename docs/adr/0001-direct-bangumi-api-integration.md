# Direct Bangumi API Integration

We integrate directly with Bangumi's official API v0 (`https://api.bgm.tv/v0`) using a Personal Access Token (PAT) rather than routing through an external proxy daemon like `bangumi-syncer`. Direct integration allows the plugin to run self-contained across desktop and mobile Obsidian without external runtime dependencies or servers.
