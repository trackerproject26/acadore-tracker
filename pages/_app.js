import '../styles/globals.css';
import Head from 'next/head';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function App({ Component, pageProps }) {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) return null;

  return (
    <>
      <Head>
        <title>Acadore Skills — Project Tracker</title>
        <meta name="description" content="Team project tracker for Acadore Skills" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </Head>
      <Component {...pageProps} session={session} />
    </>
  );
}
