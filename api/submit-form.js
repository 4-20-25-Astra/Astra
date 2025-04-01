// submit-form.js (финальная версия с правильными названиями колонок)
const { createClient } = require('@supabase/supabase-js');

// Константы Telegram
const TELEGRAM_BOT_TOKEN = '8180342154:AAEg16dbAAybWfW8ulwk_-9UvuzMmwq5IW8';
const TELEGRAM_CHAT_ID = '-4675095648';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

module.exports = async (req, res) => {
  // Настройка CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  try {
    const { first_name, last_name, email, birth_date, location, services, specialist } = req.body;

    // Валидация
    const errors = [];
    if (!first_name) errors.push('Имя обязательно');
    if (!email) errors.push('Email обязателен');
    if (!Array.isArray(services)) errors.push('Услуги должны быть массивом');
    if (!specialist) errors.push('Специалист обязателен');
    
    if (errors.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: errors.join(', ') 
      });
    }

    // 1. Получаем названия услуг из таблицы astra_services
    let serviceNames = services;
    try {
      const { data: servicesData, error: servicesError } = await supabase
        .from('astra_services')
        .select('service_id, service_name') // Исправлено на правильные названия колонок
        .in('service_id', services);

      if (!servicesError && servicesData && servicesData.length > 0) {
        serviceNames = servicesData.map(service => service.service_name);
      }
    } catch (e) {
      console.log('Не удалось получить названия услуг, используем ID:', e.message);
    }

    // 2. Получаем данные специалиста из таблицы astra_specialists
    let specialistName = specialist;
    try {
      const { data: specialistData, error: specialistError } = await supabase
        .from('astra_specialists')
        .select('specialist_id, specialist_name') // Исправлено на правильные названия колонок
        .eq('specialist_id', specialist)
        .single();

      if (!specialistError && specialistData) {
        specialistName = specialistData.specialist_name;
      }
    } catch (e) {
      console.log('Не удалось получить данные специалиста, используем ID:', e.message);
    }

    // 3. Сохраняем пользователя в таблицу users
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        first_name,
        last_name: last_name || null,
        email,
        birth_date: birth_date ? new Date(birth_date).toISOString() : null,
        location: location || null
      })
      .select()
      .single();

    if (userError) throw userError;

    // 4. Сохраняем услуги в таблицу appointments
    const { error: appointmentsError } = await supabase
      .from('appointments')
      .insert(
        services.map(service_id => ({
          user_id: user.id,
          service_id,
          specialist_id: specialist
        }))
      );

    if (appointmentsError) throw appointmentsError;

    // 5. Отправка в Telegram
    try {
      const telegramMessage = `
        🚀 <b>Новая заявка</b>
        👤 <b>Имя:</b> ${first_name}${last_name ? ' ' + last_name : ''}
        ✉️ <b>Email:</b> ${email}
        ${birth_date ? `🎂 <b>Дата рождения:</b> ${new Date(birth_date).toLocaleDateString()}\n` : ''}
        ${location ? `📍 <b>Локация:</b> ${location}\n` : ''}
        🛠 <b>Услуги:</b> ${serviceNames.join(', ')}
        👩‍⚕️ <b>Специалист:</b> ${specialistName}
      `.trim();

      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: telegramMessage,
          parse_mode: 'HTML'
        })
      });

      const result = await response.json();
      console.log('Telegram response:', result);
    } catch (tgError) {
      console.error('Telegram error:', tgError);
    }

    return res.status(200).json({ 
      success: true,
      message: 'Спасибо! Мы скоро с вами свяжемся.' 
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Ошибка при обработке заявки',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
