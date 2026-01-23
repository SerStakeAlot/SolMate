import { Composition } from 'remotion';
import { SolMatePromo, SolMatePromoSquare } from './compositions/SolMatePromo';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Main promotional video - 30 seconds @ 30fps = 900 frames */}
      <Composition
        id="SolMatePromo"
        component={SolMatePromo}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
      />
      
      {/* Square format for Instagram/Twitter - 30 seconds */}
      <Composition
        id="SolMatePromoSquare"
        component={SolMatePromoSquare}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1080}
      />
      
      {/* Vertical format for TikTok/Reels - 30 seconds */}
      <Composition
        id="SolMatePromoVertical"
        component={SolMatePromo}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
