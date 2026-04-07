// server.js
// API de contact — Cabinet avocat
// Dépendances : express, nodemailer, cors, dotenv, express-rate-limit

import 'dotenv/config';
import express         from 'express';
import nodemailer      from 'nodemailer';
import cors            from 'cors';
import { rateLimit }   from 'express-rate-limit';

const app  = express();
const PORT = process.env.PORT || 3001;

// ─────────────────────────────────────────────
// Middlewares
// ─────────────────────────────────────────────

app.use(express.json());

// CORS — n'accepte que l'origine du front Astro
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:4321',
  methods: ['POST'],
}));

// Rate limiting — max 5 envois par IP toutes les 15 minutes
// Protège contre le spam et les bots
const limiter = rateLimit({
  windowMs:         15 * 60 * 1000, // 15 minutes
  max:              5,
  standardHeaders:  true,
  legacyHeaders:    false,
  message: {
    success: false,
    message: 'Trop de tentatives. Veuillez réessayer dans 15 minutes.',
  },
});

app.use('/api/contact', limiter);

// ─────────────────────────────────────────────
// Transporteur Nodemailer
// ─────────────────────────────────────────────

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true', // true = port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Vérifie la connexion SMTP au démarrage
transporter.verify((error) => {
  if (error) {
    console.error('❌ Connexion SMTP échouée :', error.message);
  } else {
    console.log('✅ Connexion SMTP établie — prêt à envoyer des mails');
  }
});

// ─────────────────────────────────────────────
// Validation des champs
// ─────────────────────────────────────────────

function validateContactFields({ nom, prenom, email, message, rgpd, telephone }) {
  const errors = [];

  if (!nom    || nom.trim().length < 2)
    errors.push('Le nom est requis (2 caractères minimum).');

  if (!prenom || prenom.trim().length < 2)
    errors.push('Le prénom est requis (2 caractères minimum).');

  if (!telephone || telephone.trim().length < 9)
    errors.push('Le téléphone est requis (10 caractères minimum).');

  if (!email  || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    errors.push('L\'adresse e-mail est invalide.');

  if (!message || message.trim().length < 10)
    errors.push('Le message est requis (10 caractères minimum).');

  if (!rgpd || rgpd !== true)
    errors.push('L\'acceptation de la politique de confidentialité est requise.');

  return errors;
}

// ─────────────────────────────────────────────
// Templates e-mail
// ─────────────────────────────────────────────

// Mail envoyé au cabinet (notification)
function buildCabinetMail({ nom, prenom, email, telephone, message }) {
  const tel = telephone?.trim() || 'Non renseigné';
  const date = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });

  return {
    from:    process.env.MAIL_FROM,
    to:      process.env.MAIL_TO,
    replyTo: email.trim(),
    subject: `Nouveau message de contact — ${prenom.trim()} ${nom.trim()}`,
    text: `
Nouveau message reçu via le formulaire de contact.

Date : ${date}
Nom  : ${prenom.trim()} ${nom.trim()}
Email: ${email.trim()}
Tél  : ${tel}

Message :
${message.trim()}
    `.trim(),
    html: `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Nouveau message de contact</title>
</head>
<body style="margin:0;padding:0;background:#F7F5F0;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F5F0;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#2C4A3E;padding:32px 40px;">
              <p style="margin:0;font-family:Georgia,serif;font-size:22px;color:#ffffff;letter-spacing:0.02em;">
                Maître Gabard — Avocat
              </p>
              <p style="margin:6px 0 0;font-family:Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.55);letter-spacing:0.1em;text-transform:uppercase;">
                Nouveau message de contact
              </p>
            </td>
          </tr>

          <!-- Contenu -->
          <tr>
            <td style="padding:36px 40px;">

              <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:14px;color:#6B6560;">
                Reçu le <strong>${date}</strong>
              </p>

              <!-- Infos contact -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #E2DDD5;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;color:#6B6560;width:120px;">
                    Nom
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #E2DDD5;font-family:Arial,sans-serif;font-size:15px;color:#1A1814;">
                    ${prenom.trim()} ${nom.trim()}
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #E2DDD5;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;color:#6B6560;">
                    E-mail
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #E2DDD5;">
                    <a href="mailto:${email.trim()}" style="font-family:Arial,sans-serif;font-size:15px;color:#2C4A3E;text-decoration:none;">
                      ${email.trim()}
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #E2DDD5;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;color:#6B6560;">
                    Téléphone
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #E2DDD5;font-family:Arial,sans-serif;font-size:15px;color:#1A1814;">
                    ${tel}
                  </td>
                </tr>
              </table>

              <!-- Message -->
              <p style="margin:0 0 10px;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;color:#6B6560;">
                Message
              </p>
              <div style="background:#F7F5F0;border-left:3px solid #2C4A3E;border-radius:0 6px 6px 0;padding:20px 24px;">
                <p style="margin:0;font-family:Arial,sans-serif;font-size:15px;color:#1A1814;line-height:1.7;white-space:pre-wrap;">
                  ${message.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')}
                </p>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F7F5F0;padding:20px 40px;border-top:1px solid #E2DDD5;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#6B6560;text-align:center;">
                Ce message a été envoyé depuis le formulaire de contact du site web.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
  };
}

// Mail envoyé à l'expéditeur (accusé de réception)
function buildConfirmationMail({ nom, prenom, email }) {
  return {
    from:    process.env.MAIL_FROM,
    to:      email.trim(),
    subject: 'Votre message a bien été reçu — Maître Gabard',
    text: `
Bonjour ${prenom.trim()} ${nom.trim()},

Nous avons bien reçu votre message et nous vous en remercions.

Maître Gabard vous répondra dans les meilleurs délais, généralement sous 24 à 48 heures ouvrées.

Si votre situation est urgente, vous pouvez nous joindre directement par téléphone au +33 6 71 39 73 48.

Cordialement,

Maitre Gabard — Avocat au Barreau de Bordeaux
21 rue du Tondu
33000 Bordeaux
    `.trim(),
    html: `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Accusé de réception</title>
</head>
<body style="margin:0;padding:0;background:#F7F5F0;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F5F0;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#2C4A3E;padding:32px 40px;">
              <p style="margin:0;font-family:Georgia,serif;font-size:22px;color:#ffffff;">
                Maître Gabard — Avocat
              </p>
              <p style="margin:6px 0 0;font-family:Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.55);letter-spacing:0.1em;text-transform:uppercase;">
                Accusé de réception
              </p>
            </td>
          </tr>

          <!-- Contenu -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 20px;font-family:Georgia,serif;font-size:20px;color:#1A1814;">
                Bonjour ${prenom.trim()} ${nom.trim()},
              </p>
              <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:15px;color:#6B6560;line-height:1.7;">
                Nous avons bien reçu votre message et nous vous en remercions.
              </p>
              <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:15px;color:#6B6560;line-height:1.7;">
                Maître Gabard vous répondra dans les meilleurs délais, généralement sous <strong style="color:#1A1814;">24 à 48 heures ouvrées</strong>.
              </p>

              <!-- Encart urgence -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;background:#F7F5F0;border-radius:8px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;color:#2C4A3E;">
                      Situation urgente ?
                    </p>
                    <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:#6B6560;line-height:1.6;">
                      Contactez-nous directement par téléphone au
                      <a href="tel:+33671397348" style="color:#2C4A3E;font-weight:bold;text-decoration:none;">
                        +33 6 71 39 73 48
                      </a>
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-family:Arial,sans-serif;font-size:15px;color:#6B6560;line-height:1.7;">
                Cordialement,<br/>
                <strong style="color:#1A1814;">Maître Gabard</strong><br/>
                <span style="font-size:13px;">Avocat au Barreau de Bordeaux</span>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F7F5F0;padding:20px 40px;border-top:1px solid #E2DDD5;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#6B6560;text-align:center;">
                21 rue du Tondu, 33000 Bordeaux — <a href="https://www.avocat-gabard.fr/" style="color:#2C4A3E;text-decoration:none;">avocat-gabard.fr</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
  };
}

// ─────────────────────────────────────────────
// Route POST /api/contact
// ─────────────────────────────────────────────

app.post('/api/contact', async (req, res) => {
  const { nom, prenom, email, telephone, message, rgpd } = req.body;

  // Validation
  const errors = validateContactFields({ nom, prenom, email, message, rgpd, telephone });
  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  try {
    // Envoi en parallèle : notification cabinet + accusé de réception client
    await Promise.all([
      transporter.sendMail(buildCabinetMail({ nom, prenom, email, telephone, message })),
      transporter.sendMail(buildConfirmationMail({ nom, prenom, email })),
    ]);

    console.log(`📨 Message envoyé — ${prenom.trim()} ${nom.trim()} <${email.trim()}>`);

    return res.status(200).json({
      success: true,
      message: 'Votre message a bien été envoyé. Vous recevrez une confirmation par e-mail.',
    });

  } catch (error) {
    console.error('❌ Erreur d\'envoi :', error.message);

    return res.status(500).json({
      success: false,
      message: 'Une erreur est survenue lors de l\'envoi. Veuillez réessayer ou nous contacter par téléphone.',
    });
  }
});

// ─────────────────────────────────────────────
// Démarrage
// ─────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});
