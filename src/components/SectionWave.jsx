import './SectionWave.css';

// Dekorativer, handgezeichnet wirkender Wellen-Trenner zwischen zwei
// Sections - lockert die sonst harten geraden Übergänge auf.
// `fill` sollte der Hintergrundfarbe der darauffolgenden Section entsprechen.
function SectionWave({ fill = '#faf7f2', flip = false }) {
  return (
    <div className={`section-wave${flip ? ' section-wave--flip' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 1200 40" preserveAspectRatio="none">
        <path
          d="M0,16 C150,40 350,0 600,14 C850,28 1050,4 1200,18 L1200,40 L0,40 Z"
          fill={fill}
        />
      </svg>
    </div>
  );
}

export default SectionWave;
