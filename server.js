services:
  - type: web
    name: ttt-local-server
    env: node
    plan: free
    buildCommand: npm install
    startCommand: npm start
