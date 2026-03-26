// CaixaClara - Serviço de Autenticação
// Google Sign-In + JWT para sessão

const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');

// Configuração
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const JWT_SECRET = process.env.JWT_SECRET || 'caixaclara-dev-secret-trocar-em-producao';
const JWT_EXPIRATION = '24h';

// Emails autorizados (whitelist familiar)
// Formato no .env: ALLOWED_EMAILS=tiago@portabilis.com.br,esposa@gmail.com
const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

/**
 * Valida o token do Google e retorna os dados do usuário
 * @param {string} googleToken - Token ID retornado pelo Google Sign-In
 * @returns {Object} { email, nome, foto }
 */
async function validarGoogleToken(googleToken) {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: googleToken,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    return {
      email: payload.email.toLowerCase(),
      nome: payload.name || payload.email.split('@')[0],
      foto: payload.picture || null,
      google_id: payload.sub,
    };
  } catch (erro) {
    console.error('Erro ao validar token Google:', erro.message);
    throw new Error('Token do Google inválido ou expirado');
  }
}

/**
 * Verifica se o email está na whitelist
 * @param {string} email
 * @returns {boolean}
 */
function emailPermitido(email) {
  if (ALLOWED_EMAILS.length === 0) {
    console.warn('ALLOWED_EMAILS não configurado - nenhum email será aceito!');
    return false;
  }
  return ALLOWED_EMAILS.includes(email.toLowerCase());
}

/**
 * Gera um JWT para o usuário autenticado
 * @param {Object} usuario - { email, nome, foto }
 * @returns {string} JWT token
 */
function gerarJWT(usuario) {
  return jwt.sign(
    {
      email: usuario.email,
      nome: usuario.nome,
      foto: usuario.foto,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRATION }
  );
}

/**
 * Verifica e decodifica um JWT
 * @param {string} token
 * @returns {Object} payload do JWT
 */
function verificarJWT(token) {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Middleware Express - protege rotas que exigem autenticação
 * Espera header: Authorization: Bearer <jwt>
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      erro: 'Acesso não autorizado',
      mensagem: 'Token de autenticação não fornecido'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const usuario = verificarJWT(token);
    req.usuario = usuario; // Disponível em todas as rotas protegidas
    next();
  } catch (erro) {
    if (erro.name === 'TokenExpiredError') {
      return res.status(401).json({
        erro: 'Sessão expirada',
        mensagem: 'Faça login novamente',
        codigo: 'TOKEN_EXPIRED'
      });
    }
    return res.status(401).json({
      erro: 'Token inválido',
      mensagem: 'Autenticação falhou'
    });
  }
}

module.exports = {
  validarGoogleToken,
  emailPermitido,
  gerarJWT,
  verificarJWT,
  authMiddleware,
  GOOGLE_CLIENT_ID,
};
