const { createClient } = require('@supabase/supabase-js');

// Подключение к Supabase
const supabaseUrl = 'https://ваш-проект.supabase.co'; // Замените на ваш URL
const supabaseKey = 'ваш-ключ'; // Замените на ваш ключ
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
    if (req.method === 'POST') {
        const { first_name, last_name, email, phone, birth_date, location, services, specialist } = req.body;

        try {
            // Сохраняем данные пользователя
            const { data: user, error: userError } = await supabase
                .from('astra_users')
                .insert([{ first_name, last_name, email, phone, birth_date, location }])
                .single();

            if (userError) throw userError;

            // Сохраняем записи на услуги
            for (const service_id of services) {
                const { error: appointmentError } = await supabase
                    .from('astra_appointments')
                    .insert([{ user_id: user.user_id, service_id, specialist_id: specialist }]);

                if (appointmentError) throw appointmentError;
            }

            // Отправляем успешный ответ
            res.status(200).json({ message: 'Спасибо за вашу заявку! Мы свяжемся с вами в ближайшее время.' });
        } catch (error) {
            console.error('Ошибка:', error);
            res.status(500).json({ message: 'Произошла ошибка при обработке формы.' });
        }
    } else {
        res.status(405).json({ message: 'Метод не поддерживается' });
    }
};
