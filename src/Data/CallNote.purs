module Data.CallNote where

import Data.Maybe

newtype PositivityRating = PositivityRating (Maybe Number)

type CallNote = { id :: Maybe String
                , createdAt :: Maybe Number
                , customer :: String
                , notes :: String
                , positivity :: PositivityRating
                }

exampleCallNote :: CallNote
exampleCallNote = { id: Just "5abe751c73019c38d911f09af10003ba"
                  , createdAt: Just 1437321987167
                  , customer: "Chevron"
                  , notes: "Looks like they will place an order at the next call."
                  , positivity: PositivityRating (Just 4)
                  }

exampleCallNotes :: [CallNote]
exampleCallNotes = [exampleCallNote, exampleCallNote, exampleCallNote, exampleCallNote]

blankCallNote :: CallNote
blankCallNote = { id: Nothing
                  , createdAt: Nothing
                  , customer: ""
                  , notes: ""
                  , positivity: PositivityRating Nothing
                  }

positivityRating :: Number -> PositivityRating
positivityRating 1 = PositivityRating (Just 1)
positivityRating 2 = PositivityRating (Just 2)
positivityRating 3 = PositivityRating (Just 3)
positivityRating 4 = PositivityRating (Just 4)
positivityRating 5 = PositivityRating (Just 5)
positivityRating _ = PositivityRating Nothing
