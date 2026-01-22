import { Composition } from 'remotion';
import { SolMatePromo } from './compositions/SolMatePromo';
import { SolMateIntro } from './compositions/SolMateIntro';
import { SolMateFeatures } from './compositions/SolMateFeatures';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Full promotional video - 30 seconds */}
      <Composition
        id="SolMatePromo"
        component={SolMatePromo}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
      />
      
      {/* Short intro clip - 5 seconds */}
      <Composition
        id="SolMateIntro"
        component={SolMateIntro}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
      />
      
      {/* Features showcase - 15 seconds */}
      <Composition
        id="SolMateFeatures"
        component={SolMateFeatures}
        durationInFrames={450}
        fps={30}
        width={1920}
        height={1080}
      />
      
      {/* Square format for social media - 15 seconds */}
      <Composition
        id="SolMatePromoSquare"
        component={SolMatePromo}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1080}
      />
      
      {/* Vertical format for TikTok/Reels - 15 seconds */}
      <Composition
        id="SolMatePromoVertical"
        component={SolMatePromo}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
