import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { code, redirect_uri } = await req.json()

    if (!code || !redirect_uri) {
      return new Response(
        JSON.stringify({ error: 'Missing code or redirect_uri' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const clientId = Deno.env.get('REDDIT_CLIENT_ID')
    const clientSecret = Deno.env.get('REDDIT_CLIENT_SECRET')

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: 'Reddit credentials not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'RedditTLDR/1.0 (by /u/RedditTLDR)',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirect_uri,
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Reddit token exchange error:', errorText)
      return new Response(
        JSON.stringify({ error: 'Token exchange failed', details: errorText }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const tokenData = await tokenResponse.json()

    // Get user info to store username
    const userResponse = await fetch('https://oauth.reddit.com/api/v1/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'User-Agent': 'RedditTLDR/1.0 (by /u/RedditTLDR)',
      },
    })

    let username = null
    if (userResponse.ok) {
      const userData = await userResponse.json()
      username = userData.name
    }

    // Store credentials in Supabase if user is authenticated
    const authHeader = req.headers.get('Authorization')
    if (authHeader) {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      )

      const { data: { user } } = await supabaseClient.auth.getUser()
      
      if (user) {
        const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString()
        
        await supabaseClient
          .from('reddit_credentials')
          .upsert({
            user_id: user.id,
            reddit_username: username || 'unknown',
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: expiresAt,
            scope: tokenData.scope || 'read'
          })
      }
    }

    return new Response(
      JSON.stringify({
        ...tokenData,
        username
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error) {
    console.error('Error in reddit-token function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})