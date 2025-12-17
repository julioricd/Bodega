/**
 * Valida se o formato do e-mail é válido usando Regex padrão.
 */
export const validateEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

/**
 * Valida telefones brasileiros.
 * Aceita formatos:
 * (11) 99999-9999
 * (11) 9999-9999
 * 11 999999999
 * 11999999999
 */
export const validatePhone = (phone: string): boolean => {
  // Remove caracteres não numéricos
  const cleanPhone = phone.replace(/\D/g, '');
  // Verifica se tem 10 ou 11 dígitos (DDD + número)
  return cleanPhone.length >= 10 && cleanPhone.length <= 11;
};

/**
 * Valida se um campo de texto tem um tamanho mínimo.
 * Útil para campos genéricos.
 */
export const validateTextLength = (text: string, minLength: number = 2): boolean => {
  return text.trim().length >= minLength;
};

/**
 * Valida especificamente nomes de pessoas.
 * Requer no mínimo 2 caracteres e proíbe strings vazias ou apenas espaços.
 */
export const validateName = (name: string): boolean => {
  return validateTextLength(name, 2);
};

/**
 * Valida mensagens de contato.
 * Requer um conteúdo mais substancial (mínimo 10 caracteres) para evitar spam curto.
 */
export const validateMessage = (message: string): boolean => {
  return validateTextLength(message, 10);
};

/**
 * Remove tags HTML básicas para evitar XSS (Cross-Site Scripting) em inputs de texto.
 * Retorna a string limpa.
 */
export const sanitizeInput = (text: string): string => {
  return text.replace(/<[^>]*>?/gm, '');
};

export const formatPhone = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  const match = cleaned.match(/^(\d{2})(\d{5})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return phone;
};

/**
 * Valida se uma string é uma URL válida do WhatsApp.
 * Suporta formatos: wa.me/<numero>, wa.me/c/<catalogo> ou api.whatsapp.com
 */
export const validateWhatsAppUrl = (url: string): boolean => {
  if (!url) return false;
  // Regex para validar wa.me ou api.whatsapp.com
  const re = /^https?:\/\/(www\.)?(wa\.me|api\.whatsapp\.com)\/.+$/;
  return re.test(url);
};