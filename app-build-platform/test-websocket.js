#!/usr/bin/env node

const io = require('socket.io-client');

console.log('Testing WebSocket connection...\n');

const socket = io('http://localhost:3000/builds', {
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log('✓ WebSocket connected successfully!');
  console.log('  Socket ID:', socket.id);

  // Subscribe to a test task
  const testTaskId = 'test-task-123';
  console.log(`\n  Subscribing to task: ${testTaskId}`);
  socket.emit('subscribe', testTaskId);
});

socket.on('subscribed', (data) => {
  console.log('✓ Subscribed to task:', data);
});

socket.on('log', (data) => {
  console.log('📝 Log received:', data);
});

socket.on('status', (data) => {
  console.log('📊 Status update:', data);
});

socket.on('connect_error', (error) => {
  console.error('✗ Connection error:', error.message);
  process.exit(1);
});

socket.on('disconnect', (reason) => {
  console.log('✗ Disconnected:', reason);
  process.exit(0);
});

// Keep alive for 5 seconds
setTimeout(() => {
  console.log('\n✓ Test completed successfully');
  socket.disconnect();
  process.exit(0);
}, 5000);
