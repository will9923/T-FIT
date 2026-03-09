
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kyxsjdpwvmaewwxtdnxm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5eHNqZHB3dm1hZXd3eHRkbnhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NTE5NzAsImV4cCI6MjA4NzEyNzk3MH0.gwmQ2KBifGEaiEVHZq1pPAhyGUwK7tPFTe9I8NmDPzU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkPlans() {
    const { data: plans, error } = await supabase
        .from('plans')
        .select('*');

    if (error) {
        console.error('Error fetching plans:', error);
        return;
    }

    console.log('Plans found:', plans);
}

checkPlans();
