const SUPABASE_URL = "https://pudnffhwusacrquqcjei.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Sveiq2WcgtBoIa7KMjlK3g_MCFXLVjK"; 

const TELEGRAM_BOT_TOKEN = "8742400429:AAFlfYMu9wGeejkKDiqpGuytrDI33fJRwnI";
const TELEGRAM_CHAT_ID = "8582459288";

document.getElementById('registrationForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const submitBtn = document.getElementById('submitBtn');
    const loadingText = document.getElementById('loadingText');
    
    const name = document.getElementById('name').value;
    const phone = document.getElementById('phone').value;
    const game_id = document.getElementById('game_id').value;
    const tawseya = document.getElementById('tawseya').value;
    const imageFile = document.getElementById('squadImageFile').files[0];

    if (!imageFile) {
        Swal.fire('تنبيه', 'برجاء اختيار صورة التشكيلة!', 'warning');
        return;
    }

    submitBtn.style.display = 'none';
    loadingText.style.display = 'block';

    try {
        // 0. جلب أحدث بطولة نشطة لربط اللاعب بها تلقائياً
        const tRes = await fetch(`${SUPABASE_URL}/rest/v1/tournaments?order=id.desc&limit=1`, {
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
        });
        const tournaments = await tRes.json();

        if (!tournaments || tournaments.length === 0) {
            throw new Error('لا توجد أي بطولات نشطة حالياً لتسجيل اللاعب فيها.');
        }
        const currentTournamentId = tournaments[0].id;

        // 1. رفع الصورة إلى Supabase Storage (Bucket: squads)
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/squads/${fileName}`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'x-upsert': 'true'
            },
            body: imageFile
        });

        if (!uploadRes.ok) {
            throw new Error('فشل رفع الصورة على التخزين.');
        }

        const squad_image_url = `${SUPABASE_URL}/storage/v1/object/public/squads/${fileName}`;

        // 2. حفظ بيانات اللاعب في الجدول مع ربطه بالبطولة الحالية (tournament_id)
        const dbResponse = await fetch(`${SUPABASE_URL}/rest/v1/players`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({ 
                name, 
                phone, 
                game_id, 
                squad_image_url, 
                tawseya, 
                tournament_id: currentTournamentId // ربط اللاعب بالبطولة النشطة هنا
            })
        });

        if (!dbResponse.ok) {
            throw new Error('فشل حفظ البيانات في قاعدة البيانات.');
        }

        // 3. إرسال إشعار فوري لـ تيليجرام
        if (TELEGRAM_BOT_TOKEN !== "حط_توكن_البوت_هنا") {
            const message = `🚨 تسجيل لاعب جديد في البطولة!\n\n👤 الاسم: ${name}\n📱 الموبايل: ${phone}\n🎮 الـ ID: ${game_id}\n💬 الوصية: ${tawseya || 'بدون'}\n🏆 البطولة: ${tournaments[0].title}`;
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, photo: squad_image_url, caption: message })
            });
        }

        Swal.fire({
            title: 'تم تسجيلك بنجاح! 🔥',
            text: 'تم إرسال بياناتك وصورة تشكيلتك بنجاح للبطولة.',
            icon: 'success',
            confirmButtonText: 'حسناً'
        });

        document.getElementById('registrationForm').reset();

    } catch (error) {
        console.error(error);
        Swal.fire('خطأ!', error.message || 'حدث خطأ ما أثناء التسجيل، حاول مرة أخرى.', 'error');
    } finally {
        submitBtn.style.display = 'block';
        loadingText.style.display = 'none';
    }
});
