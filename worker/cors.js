// CORS: bara Grammat själv (https://buildapp.se) och lokal utveckling (localhost)
// får läsa API-svar i webbläsaren, aldrig `*`. Origin speglas bara för dessa, med Vary: Origin.
const allowedOrigin = o => {
  if (o === 'https://buildapp.se') return true;
  try {
    const u = new URL(o);
    return u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1');
  } catch (e) {
    return false;
  }
};

export const corsHeaders = req => {
  const origin = req.headers.get('Origin') || '';
  const h = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  if (allowedOrigin(origin)) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Vary'] = 'Origin';
  }
  return h;
};
