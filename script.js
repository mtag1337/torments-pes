const SUPABASE_URL = "https://pudnffhwusacrquqcjei.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Sveiq2WcgtBoIa7KMjlK3g_MCFXLVjK"; 

document.getElementById('registrationForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const name = document.getElementById('name').value;
    const phone = document.getElementById('phone').value;
    const game_id = document.getElementById('game_id').value;
    const squad_image_url = document.getElementById('squad_image_url').value;
    const tawseya = document.getElementById('tawseya').value;

    const response = await fetch(`${SUPABASE_URL}/rest/v1/players`, {
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
            tawseya
        })
    });

    if (response.ok) {
        alert('تم تسجيلك بنجاح في البطولة يا وحش! 🔥');
        document.getElementById('registrationForm').reset();
    } else {
        alert('حصل خطأ أثناء التسجيل، حاول مرة أخرى.');
    }
});