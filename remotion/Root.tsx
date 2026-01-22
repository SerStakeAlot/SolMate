import { Composition } from 'remotion';
import { SolMatePromo, SolMatePromoSquare } from './compositions/SolMatePromo';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Full promotional video - 45 seconds @ 30fps = 1350 frames */}
      <Composition
        id="SolMatePromo"
        component={SolMatePromo}
        durationInFrames={1350}
        fps={30}
        width={1920}
        height={1080}
      />
      
      {/* Square format for Instagram/Twitter - 45 seconds */}
      <Composition
        id="SolMatePromoSquare"
        component={SolMatePromoSquare}
        durationInFrames={1350}
        fps={30}
        width={1080}
        height={1080}
      />
      
      {/* Vertical format for TikTok/Reels - 45 seconds */}
      <Composition
        id="SolMatePromoVertical"
        component={SolMatePromo}
        durationInFrames={1350}
        fps={30}
        width={1080}
        height={1920}
      />
      
      {/* Short version - 30 seconds for ads */}
      <Composition
        id="SolMatePromoShort"
        component={SolMatePromo}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
