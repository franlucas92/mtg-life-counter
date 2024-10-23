// pages/index.js

"use client";
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function Index()
{

  const router = useRouter();
  useEffect(function ()
  {
    router.push("/");
  }, []);
}
