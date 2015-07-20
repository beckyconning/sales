module Main where

import Data.Void
import Data.Tuple
import Data.Maybe
import Data.Either
import Data.Array (zipWith, length, modifyAt, drop, deleteAt, (..), (!!))

import Data.CallNote

import Data.DOM.Simple.Document
import Data.DOM.Simple.Element
import Data.DOM.Simple.Types
import Data.DOM.Simple.Window

import qualified Data.String as S

import Debug.Trace

import Control.Functor (($>))
import Control.Alternative
import Control.Bind
import Control.Monad.Eff

import DOM

import Halogen
import Halogen.Signal
import Halogen.Component

import qualified Routing as Routing
import qualified Routing.Hash as Routing

import qualified Halogen.HTML as H
import qualified Halogen.HTML.Attributes as A
import qualified Halogen.HTML.Events as A
import qualified Halogen.HTML.Events.Forms as A
import qualified Halogen.HTML.Events.Handler as E

import qualified Halogen.Themes.Bootstrap3 as B
import qualified Halogen.Themes.Bootstrap3.InputGroup as BI

data ThingOurAppCanDo = List   (Maybe [CallNote])
                      | Report (Maybe [CallNote])
                      | Access (Either String CallNote)
                      | New    CallNote

data InputFromTheUser = DoSomethingElse ThingOurAppCanDo

renderHash :: ThingOurAppCanDo -> String
renderHash (List _)                  = "/call-notes"
renderHash (Report _)                = "/call-notes/report"
renderHash (Access (Left id))        = "/call-notes/" ++ id
renderHash (Access (Right callNote)) = maybe "/call-notes" (\id -> "/call-notes/" ++ id) callNote.id
renderHash (New _)                   = "/call-notes/new"

parseHash :: String -> ThingOurAppCanDo
parseHash = parse <<< drop 1 <<< S.split "/"
  where
  parse :: [String] -> ThingOurAppCanDo
  parse ["call-notes", "report"] = Report Nothing
  parse ["call-notes", "new"]    = New blankCallNote
  parse ["call-notes", id]       = Access (Left id)
  parse _                        = New blankCallNote

ui :: forall p m. (Applicative m) => Component p m InputFromTheUser InputFromTheUser
ui = render <$> stateful (Report Nothing) update
  where
  render :: ThingOurAppCanDo -> H.HTML p (m InputFromTheUser)
  render thingOurAppCanDo = H.div_ [ router thingOurAppCanDo ]

  router :: ThingOurAppCanDo -> H.HTML p (m InputFromTheUser)
  router (List _)   = H.div_ [ H.text "List" ]
  router (Report _) =
    H.div_ [ H.button [ A.onClick (A.input (\_ -> (DoSomethingElse (New blankCallNote)))) ]
           [ H.text "New" ] ]
  router (Access _) = H.div_ [ H.text "Access" ]
  router (New _)    = H.div_ [ H.text "New" ]

  update :: ThingOurAppCanDo -> InputFromTheUser -> ThingOurAppCanDo
  update (List Nothing) _                     = List (Just exampleCallNotes)
  update (Report Nothing) _                   = Report (Just exampleCallNotes)
  update (Access (Left id)) _                 = Access (Right exampleCallNote)
  update _ (DoSomethingElse thingOurAppCanDo) = thingOurAppCanDo
  update thingOurAppCanDo _                   = thingOurAppCanDo

foreign import appendToBody
  "function appendToBody(node) {\
  \  return function() {\
  \    document.body.appendChild(node);\
  \  };\
  \}" :: forall eff. Node -> Eff (dom :: DOM | eff) Node

main = do
  Tuple node driver <- runUI ui
  --Tuple node driver <- runUIWith ui postRender
  appendToBody node
  Routing.hashChanged (\oldHash newHash -> driver $ DoSomethingElse $ parseHash newHash)
    where
    --postRender (DoSomethingElse thingOurAppCanDo) _ _ = Routing.setHash $ renderHash thingOurAppCanDo

    appendToBody :: forall eff. HTMLElement -> Eff (dom :: DOM | eff) Unit
    appendToBody e = document globalWindow >>= (body >=> flip appendChild e)
