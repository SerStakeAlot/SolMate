import { Composition } from 'remotion';
import { SolMatePromo, SolMatePromoSquare } from './compositions/SolMatePromo';
import { SolMateTeaser, SolMateTeaserSquare, SolMateTeaserVertical } from './compositions/SolMateTeaser';
import { MatrixDemo, MatrixDemoSquare } from './compositions/MatrixDemo';
import { ItalianGame } from './src/videos/ItalianGame';
import { SicilianDefense } from './src/videos/SicilianDefense';
import { QueensGambit } from './src/videos/QueensGambit';
import { RuyLopez } from './src/videos/RuyLopez';
import { FrenchDefense } from './src/videos/FrenchDefense';
import { KingsIndianDefense } from './src/videos/KingsIndianDefense';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* NEW: Social Media Teaser - 40 seconds @ 30fps = 1200 frames */}
      <Composition
        id="SolMateTeaser"
        component={SolMateTeaser}
        durationInFrames={1200}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* NEW: Teaser Square format for Instagram/Twitter */}
      <Composition
        id="SolMateTeaserSquare"
        component={SolMateTeaserSquare}
        durationInFrames={1200}
        fps={30}
        width={1080}
        height={1080}
      />

      {/* NEW: Teaser Vertical format for TikTok/Reels */}
      <Composition
        id="SolMateTeaserVertical"
        component={SolMateTeaserVertical}
        durationInFrames={1200}
        fps={30}
        width={1080}
        height={1920}
      />

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

      {/* Italian Game Opening - 30 seconds @ 30fps = 900 frames */}
      <Composition
        id="ItalianGame"
        component={ItalianGame}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Sicilian Defense - 37 seconds @ 30fps = 1110 frames */}
      <Composition
        id="SicilianDefense"
        component={SicilianDefense}
        durationInFrames={1110}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Queen's Gambit - 35 seconds @ 30fps = 1050 frames */}
      <Composition
        id="QueensGambit"
        component={QueensGambit}
        durationInFrames={1050}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Ruy Lopez - 45 seconds @ 30fps = 1350 frames */}
      <Composition
        id="RuyLopez"
        component={RuyLopez}
        durationInFrames={1350}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* French Defense - 48 seconds @ 30fps = 1440 frames */}
      <Composition
        id="FrenchDefense"
        component={FrenchDefense}
        durationInFrames={1440}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* King's Indian Defense - 48 seconds @ 30fps = 1440 frames */}
      <Composition
        id="KingsIndianDefense"
        component={KingsIndianDefense}
        durationInFrames={1440}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Matrix Demo - Full app walkthrough ~4:43 @ 30fps = 8490 frames */}
      <Composition
        id="MatrixDemo"
        component={MatrixDemo}
        durationInFrames={8490}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Matrix Demo Square format */}
      <Composition
        id="MatrixDemoSquare"
        component={MatrixDemoSquare}
        durationInFrames={8490}
        fps={30}
        width={1080}
        height={1080}
      />
    </>
  );
};
