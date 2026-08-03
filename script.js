const SUPABASE_URL = "https://pudnffhwusacrquqcjei.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Sveiq2WcgtBoIa7KMjlK3g_MCFXLVjK";  

const TELEGRAM_BOT_TOKEN = "8742400429:AAFlfYMu9wGeejkKDiqpGuytrDI33fJRwnI";
const TELEGRAM_CHAT_ID = "8582459288";

// 1. كود تسجيل اللاعب
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
                tournament_id: currentTournamentId 
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

// 2. ميزة الانتقال للمرحلة التالية (جلب أحدث جولة فقط + منع تكرار المباريات + احتفالية النهائي الكبير)
async function advanceToNextRound() {
    try {
        // أ. جلب أحدث بطولة نشطة تلقائياً
        const tRes = await fetch(`${SUPABASE_URL}/rest/v1/tournaments?order=id.desc&limit=1`, {
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
        });
        const tournaments = await tRes.json();
        if (!tournaments || tournaments.length === 0) {
            Swal.fire('تنبيه', 'لا توجد بطولات نشطة.', 'warning');
            return;
        }
        const tourId = tournaments[0].id;

        // ب. جلب كل مواجهات البطولة لمعرفة أحدث جولة تم لعبها فقط
        const allMatchesRes = await fetch(`${SUPABASE_URL}/rest/v1/matches?tournament_id=eq.${tourId}&select=*`, {
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
        });
        const allMatches = await allMatchesRes.json();

        if (!allMatches || allMatches.length === 0) {
            Swal.fire('تنبيه', 'لا توجد مواجهات مسجلة للبطولة الحالية.', 'warning');
            return;
        }

        // تحديد اسم أآخر جولة تم لعبها حالياً
        const latestRoundName = allMatches[allMatches.length - 1].round_name;

        // تصفية المباريات لأخذ مباريات الجولة الأخيرة فقط لمنع تكرار المباريات القديمة
        const currentRoundMatches = allMatches.filter(m => m.round_name === latestRoundName);

        // ج. التأكد من انتهاء جميع مباريات الجولة الحالية وتحديد فائزين لها
        const uncompleted = currentRoundMatches.filter(m => m.status !== 'completed' && m.player2_id !== null);
        if (uncompleted.length > 0) {
            Swal.fire('تنبيه', 'لا يمكن الانتقال للمرحلة التالية حتى يتم تحديد الفائزين في جميع مواجهات الجولة الحالية!', 'error');
            return;
        }

        // د. تجميع IDs فائزين الجولة الأخيرة فقط بدقة وتصفيتهم باستخدام Set
        let rawWinnersIds = [];
        currentRoundMatches.forEach(m => {
            if (m.winner_id) {
                rawWinnersIds.push(m.winner_id);
            }
        });

        let winnersIds = [...new Set(rawWinnersIds)];

        // هـ. لو لم يتبق سوى لاعب واحد، فهذا هو بطل البطولة النهائي (احتفالية كبرى أسطورية)
        if (winnersIds.length === 1) {
            const champRes = await fetch(`${SUPABASE_URL}/rest/v1/players?id=eq.${winnersIds[0]}&select=name`, {
                headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
            });
            const champData = await champRes.json();
            const champName = (champData && champData.length > 0) ? champData[0].name : 'اللاعب الفائز';

            Swal.fire({
                title: '🏆 نهائي أسطوري وتتويج بطل البطولة!',
                html: `
                    <div style="padding: 10px;">
                        <p style="color: #9ca3af; font-size: 15px; margin-bottom: 10px;">لقد حسمت المعركة النهائية وأسدل الستار على البطولة بنجاح تام!</p>
                        <h2 style="color: #facc15; margin-top: 15px; font-size: 30px; text-shadow: 0 0 15px rgba(250,204,21,0.5);">👑 ${champName} 👑</h2>
                        <p style="color: #34d399; margin-top: 15px; font-weight: bold;">بطل البطولة بلا منازع! 🔥</p>
                    </div>
                `,
                icon: 'success',
                background: '#111827',
                color: '#fff',
                confirmButtonText: 'مبروك للبطل 🚀'
            });
            return;
        }

        if (winnersIds.length === 0) {
            Swal.fire('تنبيه', 'لم يتم العثور على أي فائزين محددين في الجولة السابقة.', 'warning');
            return;
        }

        // و. الذكاء البرمجي لاقتراح اسم الجولة بدقة (لو بقوا 2 سيقترح النهائي الكبير فوراً)
        let defaultRoundName = '';
        if (winnersIds.length === 2) {
            defaultRoundName = 'النهائي الكبير 🏆';
        } else if (winnersIds.length === 3 || winnersIds.length === 4) {
            defaultRoundName = 'نصف النهائي ⚔️';
        } else if (winnersIds.length > 4 && winnersIds.length <= 8) {
            defaultRoundName = 'ربع النهائي ⚡';
        } else {
            defaultRoundName = `دور الـ ${winnersIds.length}`;
        }

        // ز. نافذة منبثقة تفاعلية لتعديل أو ترك اسم الجولة
        const { value: customRoundName } = await Swal.fire({
            title: '⚡ الانتقال للمرحلة التالية',
            background: '#111827',
            color: '#fff',
            html: `
                <div style="text-align: right; margin-bottom: 10px;">
                    <p style="color: #9ca3af; font-size: 13px; margin-bottom: 8px;">عدد المتأهلين الحقيقيين هو <b>(${winnersIds.length} لاعبين)</b>.</p>
                    <label style="display:block; margin-bottom:5px; font-weight:bold;">اسم الجملة أو المرحلة التي ستظهر للجمهور:</label>
                    <input id="swal-round-input" class="swal2-input" value="${defaultRoundName}" placeholder="اكتب اسم المرحلة هنا..." style="width:90%; margin:0; background:#0d1322; color:#fff; border:1px solid #374151; text-align: center; font-weight: bold; color: #60a5fa;">
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'توزيع المباريات وإطلاق الجولة 🚀',
            cancelButtonText: 'إلغاء',
            preConfirm: () => {
                const inputVal = document.getElementById('swal-round-input').value.trim();
                return inputVal !== "" ? inputVal : defaultRoundName;
            }
        });

        if (!customRoundName) return;

        // ح. خلط عشوائي آمن (Shuffling) مع حماية تامة ضد لعب اللاعب مع نفسه
        let shuffledWinners = [...winnersIds].sort(() => Math.random() - 0.5);
        let nextRoundMatches = [];

        for (let i = 0; i < shuffledWinners.length; i += 2) {
            let player1 = shuffledWinners[i];
            let player2 = shuffledWinners[i+1] || null;

            if (player2 && player1 === player2) {
                player2 = null;
            }

            if (player2 !== null) {
                nextRoundMatches.push({
                    tournament_id: parseInt(tourId),
                    round_name: customRoundName,
                    player1_id: player1,
                    player2_id: player2,
                    winner_id: null,
                    status: 'pending'
                });
            } else {
                // تأهل تلقائي (Bye) في حالة بقاء لاعب فردي بدون منافس
                nextRoundMatches.push({
                    tournament_id: parseInt(tourId),
                    round_name: customRoundName,
                    player1_id: player1,
                    player2_id: null,
                    winner_id: player1,
                    status: 'completed'
                });
            }
        }

        // ط. إرسال مباريات المرحلة الجديدة لقاعدة البيانات
        const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/matches`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(nextRoundMatches)
        });

        if (insertRes.ok) {
            Swal.fire('تم بنجاح! 🔥', `تم بدء مباريات (${customRoundName}) بنجاح وبدون أي تكرار للمباريات السابقة!`, 'success');
        } else {
            const err = await insertRes.json();
            Swal.fire('خطأ', 'فشل الانتقال للمرحلة التالية: ' + (err.message || ''), 'error');
        }
    } catch (error) {
        console.error(error);
        Swal.fire('خطأ!', 'حدث خطأ غير متوقع أثناء الانتقال للمرحلة التالية.', 'error');
    }
}
