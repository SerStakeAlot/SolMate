import React from "react";
import { Composition } from "remotion";
import { HowPiecesMove } from "./videos/HowPiecesMove";
import { SpecialMoves } from "./videos/SpecialMoves";
import { CheckmateBasics } from "./videos/CheckmateBasics";
import { ChessNotation } from "./videos/ChessNotation";
import { OpeningPrinciples } from "./videos/OpeningPrinciples";

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
    </>
  );
};
