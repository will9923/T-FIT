
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kyxsjdpwvmaewwxtdnxm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5eHNqZHB3dm1hZXd3eHRkbnhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NTE5NzAsImV4cCI6MjA4NzEyNzk3MH0.gwmQ2KBifGEaiEVHZq1pPAhyGUwK7tPFTe9I8NmDPzU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkAdminConfig() {
    const { data: admins, error: adminError } = await supabase
        .from('profiles')
        .select('id, name, role')
        .eq('role', 'admin');

    if (adminError) {
        console.error('Error fetching admins:', adminError);
        return;
    }

    console.log('Admins found:', admins);

    if (admins && admins.length > 0) {
        const adminIds = admins.map(a => a.id);
        const { data: configs, error: configError } = await supabase
            .from('payment_configs')
            .select('user_id, public_key, status_config')
            .in('user_id', adminIds);

        if (configError) {
            console.error('Error fetching configs:', configError);
            return;
        }

        console.log('Payment Configs for Admins:', configs);
    } else {
        console.log('No admins found.');
    }
}

checkAdminConfig();
