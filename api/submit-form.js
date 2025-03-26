import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Метод не поддерживается' });
  }

  try {
    const { first_name, last_name, email, birth_date, location, services, specialist } = req.body;

    // Валидация
    if (!first_name || !last_name || !email || !birth_date || !location || !services || !specialist) {
      return res.status(400).json({ message: 'Все поля обязательны для заполнения' });
    }

    // Проверка/создание пользователя
    let { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (!user) {
      const { data: newUser, error: newUserError } = await supabase
        .from('users')
        .insert([{ 
          first_name, 
          last_name, 
          email, 
          birth_date, 
          location 
        }])
        .select()
        .single();
      
      if (newUserError) throw newUserError;
      user = newUser;
    }

    // Создание записей на услуги
    for (const service_id of services) {
      const { error: appointmentError } = await supabase
        .from('appointments')
        .insert([{
          user_id: user.id,
          service_id: parseInt(service_id),
          specialist_id: parseInt(specialist)
        }]);
      
      if (appointmentError) throw appointmentError;
    }

    return res.status(200).json({ 
      message: 'Спасибо! Ваша заявка принята. Мы свяжемся с вами в ближайшее время.' 
    });

  } catch (error) {
    console.error('Ошибка:', error);
    return res.status(500).json({ 
      message: error.message || 'Произошла ошибка при обработке формы' 
    });
  }
}
