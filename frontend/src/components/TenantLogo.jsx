import React, { useState } from "react";

export default function TenantLogo({
  slug,
  name = "Agency",
  size = 40,
  className = "",
}) {
  const [hasError, setHasError] = useState(false);

  // Determine logo path based on tenant slug
  let src = "/logos/platescan.svg";
  if (slug === "alpha") {
    src = "/logos/alpha.svg";
  } else if (slug === "beta") {
    src = "/logos/beta.svg";
  }

  if (hasError) {
    const initial = (slug ? slug.charAt(0) : name.charAt(0)).toUpperCase();
    return (
      <div
        className={`tenant-logo-fallback ${className}`}
        style={{
          width: size,
          height: size,
          fontSize: Math.round(size * 0.45),
        }}
        title={name}
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${name} Logo`}
      className={`tenant-logo-img ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.22),
      }}
      onError={() => setHasError(true)}
    />
  );
}
