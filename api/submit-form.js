import { createClient } from '@supabase/supabase-js';
import sgMail from '@sendgrid/mail';

// Инициализация
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  try {
    const { first_name, last_name, email, birth_date, location, services, specialist } = req.body;

    // Валидация
    if (!first_name || !last_name || !email || !birth_date || !location || !services || !specialist) {
      return res.status(400).json({ message: 'Все поля обязательны' });
    }

    // 1. Создаем пользователя
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        first_name,
        last_name,
        email,
        birth_date: new Date(birth_date).toISOString(),
        location
      })
      .select()
      .single();

    if (userError) throw userError;

    // 2. Создаем записи о назначениях (без поля status)
    const appointmentsData = services.map(service_id => ({
      user_id: user.id,
      service_id,
      specialist_id: specialist,
      created_at: new Date().toISOString() // Добавляем текущую дату
    }));

    const { error: appointmentsError } = await supabase
      .from('appointments')
      .insert(appointmentsData);

    if (appointmentsError) throw appointmentsError;

    // 3. Отправка уведомлений
    const adminMsg = {
      to: process.env.ADMIN_EMAIL || 'petersonanastasia594@gmail.com',
      from: process.env.SENDGRID_FROM_EMAIL,
      subject: `Новая заявка от ${first_name} ${last_name}`,
      html: `
        <h2>Новая заявка на консультацию</h2>
        <p><strong>Клиент:</strong> ${first_name} ${last_name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Дата рождения:</strong> ${new Date(birth_date).toLocaleDateString()}</p>
        <p><strong>Местоположение:</strong> ${location}</p>
        <p><strong>Услуги:</strong> ${services.join(', ')}</p>
        <p><strong>Специалист:</strong> ${specialist}</p>
        <p><strong>Дата заявки:</strong> ${new Date().toLocaleString()}</p>
      `
    };

    const clientMsg = {
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject: 'Ваша заявка принята',
      html: `
        <h2>Спасибо, ${first_name}!</h2>
        <p>Ваша заявка на услуги (${services.join(', ')}) принята.</p>
        <p>Мы свяжемся с вами в ближайшее время.</p>
      `
    };

    await Promise.all([
      sgMail.send(adminMsg),
      sgMail.send(clientMsg)
    ]).catch(e => console.error('Email error:', e));

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Ошибка обработки:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Ошибка при обработке заявки',
      error: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
}
