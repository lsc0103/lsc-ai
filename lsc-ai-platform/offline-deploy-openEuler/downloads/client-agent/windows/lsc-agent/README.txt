=================================================
  LSC-AI Client Agent - Windows Installation Guide
=================================================

System Requirements:
- Windows 10/11 64-bit
- Node.js 20.x or higher

First Time Setup:

1. Install Node.js (if not installed)
   Download from: https://nodejs.org/
   Recommended: Node.js 20.x LTS

2. Pair with Server
   Double-click: 配对到服务器.bat
   Enter the pairing code shown on screen

3. Start Agent
   Double-click: lsc-agent.bat

Commands:

  lsc-agent.bat start        - Start agent (foreground)
  lsc-agent.bat daemon       - Start agent (background)
  lsc-agent.bat status       - Show status
  lsc-agent.bat config       - Show configuration
  lsc-agent.bat unpair       - Unpair from server
  lsc-agent.bat autostart enable  - Enable autostart

Configuration Files:

  %USERPROFILE%\.lsc-ai\config.json      - Configuration
  %USERPROFILE%\.lsc-ai\client-agent.db  - Local database

Troubleshooting:

Q: "Node.js not found"
A: Install Node.js 20.x from https://nodejs.org/

Q: Cannot connect to server
A: Check:
   1. Server URL is correct (http://10.18.55.233)
   2. Network connection
   3. Firewall settings

Q: How to update?
A: Download new version and replace files.
   Your configuration will be preserved.

For support, contact your system administrator.
