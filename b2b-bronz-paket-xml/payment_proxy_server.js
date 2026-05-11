const fastify = require('fastify')({ logger: true });
const QNB_GATEWAY = 'https://vpos.qnb.com.tr';

fastify.register(require('fastify-reply-from'), {
  base: QNB_GATEWAY
});

// QNB XML Gate - Doküman Sayfa 37'deki kesin adres (Case Sensitive)
fastify.post('/vpos/XMLGate.aspx', (request, reply) => {
  reply.from('/Gateway/XMLGate.aspx'); 
});

// Geriye dönük uyumluluk için küçük harfli versiyonu da yönlendiriyoruz
fastify.post('/vpos/XmlGate.aspx', (request, reply) => {
  reply.from('/Gateway/XMLGate.aspx'); 
});

fastify.get('/health', async () => {
  return { 
    status: 'ok', 
    server: 'Google Cloud Proxy (Updated)', 
    ip: '34.63.166.56',
    target: QNB_GATEWAY
  };
});

const start = async () => {
  try {
    await fastify.listen({ port: 80, host: '0.0.0.0' });
  } catch (err) {
    process.exit(1);
  }
};

start();
