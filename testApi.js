import api from './utils/api.js';

console.log('API instance:', api);
console.log('API post:', typeof api.post);

api.get('/').then(res => console.log('Test response:', res.data)).catch(err => console.error('Test error:', err));