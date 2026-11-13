export function Emblem({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 500 500"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="metal"
          x1="70"
          y1="60"
          x2="420"
          y2="430"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#f6d98d" />
          <stop offset=".38" stopColor="#a78042" />
          <stop offset=".62" stopColor="#ecd28e" />
          <stop offset="1" stopColor="#64502d" />
        </linearGradient>
        <linearGradient
          id="face"
          x1="100"
          x2="400"
          y2="430"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#292b2c" />
          <stop offset="1" stopColor="#0a1020" />
        </linearGradient>
      </defs>
      <g className="artifact">
        <path
          className="draw"
          d="M250 45 427 146V351L250 454 73 351V146Z"
          fill="url(#face)"
          stroke="url(#metal)"
          strokeWidth="3"
        />
        <path
          className="draw"
          d="M250 45V250L427 351M73 146 250 250 427 146M250 250V454"
          stroke="url(#metal)"
          strokeWidth="3"
        />
        <path
          className="draw"
          d="m250 75 151 86v175L250 424 99 336V161Z M250 104 376 176v145L250 395 124 321V176Z"
          stroke="url(#metal)"
        />
        <path
          d="m250 104 126 72-126 74-126-74Z"
          fill="#dbc17d"
          fillOpacity=".045"
        />
        <path
          d="m250 285 126-72v108l-126 74Z"
          fill="#05070d"
          fillOpacity=".6"
        />
        <g stroke="#ac8f52" strokeWidth="2">
          <path d="m149 183 101-59 101 59-101 59Z M150 207v97l76 44v-96 M274 274l76-44v74l-76 44Z" />
          <path d="m173 183 77-44 77 44-77 44Z M168 238v54l39 23v-54 M294 286l36-21v28l-36 21Z" />
        </g>
        <path
          className="core"
          d="m250 212 34 20v38l-34 20-34-20v-38Z"
          fill="#e5bd65"
        />
        <path d="m250 223 24 14-24 14-24-14Z" fill="#f9e4a7" />
        <path d="M250 251v27l24-14v-27Z" fill="#a2874b" />
        <g stroke="#55ddf3" strokeWidth="2">
          <path d="m73 286 26 15M401 201l26-15M250 45v30" />
        </g>
      </g>
    </svg>
  );
}
