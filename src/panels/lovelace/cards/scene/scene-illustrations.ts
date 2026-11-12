import { svg } from "lit";

export interface HouseRoom {
  id: string;
  glow: number;
}

export interface HouseFloor {
  id: string;
  rooms: HouseRoom[];
}

export interface HouseModel {
  floors: HouseFloor[];
  outside: number;
  any: boolean;
}

const GROUND = 388;
const MAX_WINDOWS = 6;

const windowSegments = (rooms: HouseRoom[]): number[] => {
  if (!rooms.length) {
    return [0];
  }
  if (rooms.length <= MAX_WINDOWS) {
    return rooms.map((r) => r.glow);
  }
  const head = rooms.slice(0, MAX_WINDOWS - 1).map((r) => r.glow);
  const rest = Math.max(...rooms.slice(MAX_WINDOWS - 1).map((r) => r.glow));
  return [...head, rest];
};

const renderWindows = (
  x: number,
  y: number,
  w: number,
  h: number,
  glows: number[],
  dark: boolean
) => {
  const segW = w / glows.length;
  const frame = dark ? "#0C0E11" : "#2A2C30";
  return svg`
    <rect x=${x} y=${y} width=${w} height=${h} fill="url(#hGlass)"></rect>
    ${glows.map(
      (g, i) => svg`<rect
        class="glow"
        x=${x + i * segW}
        y=${y}
        width=${segW}
        height=${h}
        fill="url(#hGlow)"
        opacity=${g > 0 ? g : 0.05}
      ></rect>`
    )}
    <polygon points=${`${x},${y} ${x + Math.min(50, segW * 0.6)},${y} ${x + Math.min(22, segW * 0.3)},${y + h} ${x},${y + h}`} fill="#FFFFFF" opacity="0.06"></polygon>
    ${glows
      .slice(1)
      .map(
        (_g, i) =>
          svg`<path d=${`M${x + (i + 1) * segW} ${y}V${y + h}`} stroke=${frame} stroke-width="3"></path>`
      )}
    <rect x=${x} y=${y} width=${w} height=${h} fill="none" stroke=${frame} stroke-width="3"></rect>
  `;
};

export const renderHouse = (model: HouseModel) => {
  const floors = model.floors.length
    ? model.floors.slice(0, 5)
    : [{ id: "_", rooms: [] }];
  const n = floors.length;
  const floorH = Math.max(58, Math.min(112, 250 / n));
  const blocks = floors.map((floor, i) => {
    const w = i === 0 ? 440 : Math.max(300, 420 - 30 * (i - 1));
    const x = i === 0 ? 150 : i % 2 === 1 ? 250 : 180;
    const top = GROUND - floorH * (i + 1) - (i === 0 ? 26 : 0);
    const h = i === 0 ? floorH + 26 : floorH;
    return { floor, i, x, w, top, h };
  });
  const minX = Math.min(...blocks.map((b) => b.x));
  const maxX = Math.max(...blocks.map((b) => b.x + b.w));
  const topBlock = blocks[blocks.length - 1];

  return svg`
  <svg viewBox="0 0 800 440" aria-hidden="true" class="house">
    <defs>
      <linearGradient id="hPlaster" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F6F4F0"></stop><stop offset="1" stop-color="#BEBAB3"></stop></linearGradient>
      <linearGradient id="hConcrete" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3A3D43"></stop><stop offset="1" stop-color="#1F2125"></stop></linearGradient>
      <linearGradient id="hGlass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2B3846"></stop><stop offset="1" stop-color="#0E1318"></stop></linearGradient>
      <linearGradient id="hGlow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE1A8"></stop><stop offset="0.55" stop-color="#F2B45A"></stop><stop offset="1" stop-color="#9A5F22"></stop></linearGradient>
      <linearGradient id="hPool" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7CC6EE"></stop><stop offset="1" stop-color="#1A4766"></stop></linearGradient>
      <radialGradient id="hHalo" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#F2B45A" stop-opacity="0.30"></stop><stop offset="1" stop-color="#F2B45A" stop-opacity="0"></stop></radialGradient>
      <radialGradient id="hShadow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000000" stop-opacity="0.75"></stop><stop offset="1" stop-color="#000000" stop-opacity="0"></stop></radialGradient>
      <linearGradient id="hFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.24"></stop><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"></stop></linearGradient>
      <mask id="hRefMask"><rect x="0" y="388" width="800" height="52" fill="url(#hFade)"></rect></mask>
      <pattern id="hSlats" width="7" height="10" patternUnits="userSpaceOnUse"><rect width="7" height="10" fill="#7A5434"></rect><rect width="2" height="10" fill="#3B2716"></rect></pattern>
    </defs>
    <ellipse class="glow" cx="400" cy=${GROUND - 98} rx="390" ry="175" fill="url(#hHalo)" opacity=${model.any ? 1 : 0.15}></ellipse>
    <ellipse cx=${(minX + maxX) / 2} cy="390" rx=${(maxX - minX) / 2 + 60} ry="16" fill="url(#hShadow)"></ellipse>
    <g id="hHouse">
      <ellipse class="tree1" cx=${minX - 38} cy="298" rx="20" ry="92"></ellipse>
      <ellipse class="tree2" cx=${minX - 66} cy="326" rx="14" ry="64"></ellipse>
      <ellipse class="tree1" cx=${Math.min(760, maxX + 66)} cy="320" rx="16" ry="70"></ellipse>
      ${blocks.map((b) => {
        const concrete = b.i % 2 === 0;
        const fill = concrete ? "url(#hConcrete)" : "url(#hPlaster)";
        const side = concrete ? "#16181B" : "#8D8982";
        const glows = windowSegments(b.floor.rooms);
        const winY = b.top + (b.i === 0 ? 24 : b.h * 0.2);
        const winH = b.i === 0 ? b.h - 24 : b.h * 0.58;
        const winW = b.i === 0 ? b.w - 22 - 150 : b.w - 44;
        const dx = b.x + b.w;
        return svg`
          <polygon points=${`${dx},${b.top} ${dx + 18},${b.top + 7} ${dx + 18},${b.top + b.h} ${dx},${b.top + b.h}`} fill=${side}></polygon>
          <rect x=${b.x} y=${b.top} width=${b.w} height=${b.h} fill=${fill}></rect>
          ${renderWindows(b.x + 22, winY, winW, winH, glows, concrete)}
          ${
            b.i === 0
              ? svg`
                <rect x=${b.x + b.w - 140} y=${GROUND - 90} width="56" height="90" fill="#0F1114"></rect>
                <path d=${`M${b.x + b.w - 92} ${GROUND - 62}V${GROUND - 28}`} stroke="#C9A36A" stroke-width="2.5" stroke-linecap="round"></path>
                <rect class="glow" x=${b.x + b.w - 134} y=${GROUND - 98} width="44" height="3" rx="1.5" fill="#FFE1A8" opacity=${model.outside ? 1 : 0.08}></rect>
                <rect x=${b.x + b.w - 70} y=${winY} width="56" height=${GROUND - winY} fill="url(#hSlats)"></rect>`
              : svg`<rect x=${b.x} y=${b.top + b.h} width=${b.w} height="10" fill="#000000" opacity="0.35"></rect>`
          }
        `;
      })}
      <rect x=${topBlock.x - 12} y=${topBlock.top - 11} width=${topBlock.w + 24} height="12" fill=${topBlock.i % 2 === 0 ? "#2E3136" : "#FBFAF7"}></rect>
      <rect x=${Math.min(maxX + 60, 740)} y=${GROUND - 138} width="8" height="138" fill="#D6D2CB"></rect>
      <rect class="glow" x=${Math.min(maxX + 4, 690)} y=${GROUND - 136} width="56" height="3" fill="#FFE1A8" opacity=${model.outside ? 1 : 0.08}></rect>
      <ellipse class="glow" cx=${Math.min(maxX + 34, 720)} cy="386" rx="52" ry="5" fill="#F2B45A" opacity=${model.outside ? 0.35 : 0}></ellipse>
    </g>
    <g mask="url(#hRefMask)"><use href="#hHouse" transform="translate(0 776) scale(1 -1)"></use></g>
    <path class="ground" d="M40 388.5H760"></path>
    <polygon points="96,400 470,400 506,418 64,418" fill="url(#hPool)" opacity="0.85"></polygon>
    <path d="M104 401.5H462" stroke="#FFFFFF" stroke-opacity="0.55"></path>
  </svg>
`;
};

export interface RoomGlow {
  ceiling: number;
  floor: number;
  strip: number;
  wall: number;
  coverOpen: number;
}

export const renderRoom = (g: RoomGlow) => svg`
  <svg viewBox="0 0 800 440" aria-hidden="true" class="room">
    <defs>
      <linearGradient id="rWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="wall-top"></stop><stop offset="1" class="wall-bottom"></stop></linearGradient>
      <linearGradient id="rFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="floor-top"></stop><stop offset="1" class="floor-bottom"></stop></linearGradient>
      <linearGradient id="rSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0B1522"></stop><stop offset="1" stop-color="#22374D"></stop></linearGradient>
      <radialGradient id="rWarm" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#FFC979" stop-opacity="0.55"></stop><stop offset="1" stop-color="#FFC979" stop-opacity="0"></stop></radialGradient>
      <pattern id="rSlat" width="10" height="12" patternUnits="userSpaceOnUse"><rect width="10" height="12" fill="#D9D4CA"></rect><rect y="10" width="10" height="2" fill="#A9A399"></rect></pattern>
      <clipPath id="rWinClip"><rect x="470" y="60" width="260" height="240"></rect></clipPath>
    </defs>
    <rect x="0" y="0" width="800" height="330" rx="28" fill="url(#rWall)"></rect>
    <rect x="0" y="330" width="800" height="110" fill="url(#rFloor)"></rect>
    <rect class="glow" x="40" y="34" width="380" height="4" rx="2" fill="#FFD9A0" opacity=${g.strip ? 1 : 0.06}></rect>
    <ellipse class="glow" cx="230" cy="70" rx="260" ry="60" fill="url(#rWarm)" opacity=${g.strip}></ellipse>
    <rect x="470" y="60" width="260" height="240" fill="url(#rSky)"></rect>
    <g fill="#FFFFFF" opacity="0.7"><circle cx="502" cy="96" r="1.6"></circle><circle cx="560" cy="140" r="1.2"></circle><circle cx="640" cy="88" r="1.8"></circle><circle cx="700" cy="170" r="1.3"></circle><circle cx="610" cy="220" r="1.5"></circle><circle cx="520" cy="250" r="1.2"></circle><circle cx="680" cy="262" r="1.6"></circle></g>
    <g clip-path="url(#rWinClip)"><rect class="blind" x="470" y="60" width="260" height=${Math.round(((100 - g.coverOpen) / 100) * 240)} fill="url(#rSlat)"></rect></g>
    <path class="frame" d="M600 60V300M470 180H730" stroke-width="4"></path>
    <rect class="frame" x="470" y="60" width="260" height="240" fill="none" stroke-width="6"></rect>
    <rect class="glow" x="440" y="150" width="8" height="26" rx="3" fill="#FFE1A8" opacity=${g.wall ? 1 : 0.08}></rect>
    <ellipse class="glow" cx="444" cy="166" rx="70" ry="70" fill="url(#rWarm)" opacity=${g.wall}></ellipse>
    <ellipse class="rug" cx="290" cy="370" rx="250" ry="40"></ellipse>
    <ellipse class="glow" cx="300" cy="230" rx="230" ry="150" fill="url(#rWarm)" opacity=${g.ceiling}></ellipse>
    <path class="cord" d="M300 0V104" stroke-width="2"></path>
    <path class="shade" d="M258 118a42 14 0 0 1 84 0z"></path>
    <ellipse class="glow" cx="300" cy="118" rx="42" ry="5" fill="#FFE7BF" opacity=${g.ceiling ? 1 : 0.15}></ellipse>
    <ellipse class="glow" cx="96" cy="150" rx="120" ry="130" fill="url(#rWarm)" opacity=${g.floor}></ellipse>
    <path class="cord" d="M70 352V150q0-34 56-40" fill="none" stroke-width="4" stroke-linecap="round"></path>
    <path class="shade" d="M104 112l44-6 6 26-40 6z"></path>
    <ellipse class="cord-fill" cx="70" cy="354" rx="22" ry="5"></ellipse>
    <rect class="sofa-back" x="100" y="222" width="330" height="56" rx="20"></rect>
    <rect class="sofa" x="110" y="262" width="310" height="62" rx="14"></rect>
    <rect class="sofa-back" x="92" y="246" width="40" height="80" rx="14"></rect>
    <rect class="sofa-back" x="398" y="246" width="40" height="80" rx="14"></rect>
    <rect class="cushion" x="142" y="240" width="120" height="34" rx="12"></rect>
    <rect class="cushion" x="268" y="240" width="120" height="34" rx="12"></rect>
    <rect class="cord-fill" x="120" y="324" width="8" height="12"></rect><rect class="cord-fill" x="402" y="324" width="8" height="12"></rect>
    <ellipse class="table" cx="300" cy="372" rx="96" ry="14"></ellipse>
    <rect class="table" x="296" y="372" width="8" height="30"></rect>
    <ellipse class="table" cx="300" cy="404" rx="40" ry="5"></ellipse>
  </svg>
`;
