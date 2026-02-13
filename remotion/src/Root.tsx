import React from "react";
import { Composition } from "remotion";
import { HowPiecesMove } from "./videos/HowPiecesMove";
import { SpecialMoves } from "./videos/SpecialMoves";
import { CheckmateBasics } from "./videos/CheckmateBasics";
import { ChessNotation } from "./videos/ChessNotation";
import { OpeningPrinciples } from "./videos/OpeningPrinciples";
import { ItalianGame } from "./videos/ItalianGame";
import { SicilianDefense } from "./videos/SicilianDefense";
import { QueensGambit } from "./videos/QueensGambit";
import { RuyLopez } from "./videos/RuyLopez";
import { FrenchDefense } from "./videos/FrenchDefense";
import { KingsIndianDefense } from "./videos/KingsIndianDefense";
import { LondonSystem } from "./videos/LondonSystem";
import { SolMateTeaser, SolMateTeaserSquare, SolMateTeaserVertical } from '../compositions/SolMateTeaser';
import { SolMatePromo, SolMatePromoSquare } from '../compositions/SolMatePromo';
import { MatrixDemo, MatrixDemoSquare } from '../compositions/MatrixDemo';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="HowPiecesMove"
        component={HowPiecesMove}
        durationInFrames={900} // 30 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="SpecialMoves"
        component={SpecialMoves}
        durationInFrames={660} // 22 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="CheckmateBasics"
        component={CheckmateBasics}
        durationInFrames={660} // 22 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="ChessNotation"
        component={ChessNotation}
        durationInFrames={810} // 27 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="OpeningPrinciples"
        component={OpeningPrinciples}
        durationInFrames={900} // 30 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="ItalianGame"
        component={ItalianGame}
        durationInFrames={900} // 30 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Sicilian Defense - 37 seconds at 30fps = 1110 frames */}
      <Composition
        id="SicilianDefense"
        component={SicilianDefense}
        durationInFrames={1110}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Queen's Gambit - 35 seconds at 30fps = 1050 frames */}
      <Composition
        id="QueensGambit"
        component={QueensGambit}
        durationInFrames={1050}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Ruy Lopez - 45 seconds at 30fps = 1350 frames */}
      <Composition
        id="RuyLopez"
        component={RuyLopez}
        durationInFrames={1350}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* French Defense - 48 seconds at 30fps = 1440 frames */}
      <Composition
        id="FrenchDefense"
        component={FrenchDefense}
        durationInFrames={1440}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* King's Indian Defense - 48 seconds at 30fps = 1440 frames */}
      <Composition
        id="KingsIndianDefense"
        component={KingsIndianDefense}
        durationInFrames={1440}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* London System - 46 seconds at 30fps = 1380 frames */}
      <Composition
        id="LondonSystem"
        component={LondonSystem}
        durationInFrames={1380}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Social Media Teaser - 30 seconds */}
      <Composition
        id="SolMateTeaser"
        component={SolMateTeaser}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="SolMateTeaserSquare"
        component={SolMateTeaserSquare}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1080}
      />
      <Composition
        id="SolMateTeaserVertical"
        component={SolMateTeaserVertical}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
      />

      {/* Promotional Video - 30 seconds */}
      <Composition
        id="SolMatePromo"
        component={SolMatePromo}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="SolMatePromoSquare"
        component={SolMatePromoSquare}
        durationInFrames={900}
        fps={30}
        width={1080}
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
