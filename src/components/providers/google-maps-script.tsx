"use client";

import Script from "next/script";

export function GoogleMapsScript() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return null;
  }

  return (
    <Script
      id="google-maps-script"
      src={`https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`}
      strategy="afterInteractive"
      onLoad={() => {
        window.dispatchEvent(new Event("google-maps-loaded"));
      }}
      onError={() => {
        window.dispatchEvent(new Event("google-maps-error"));
      }}
    />
  );
}
