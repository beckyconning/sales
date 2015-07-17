Feature: Seven day sales call report

  As a sales manager
  I want to access a report about my sales reps' calls over the last seven days
  So that I can predict sales a month from now and react to predicted sales

  Scenario: Access seven day sales call report
    When I access my seven day sales call report
    Then I should be presented with an average of rep positivity about sales calls over the last seven days
    And I should be presented with a comparison between the last seven days' positivity and the seven days prior
    And I should be presented with a list of my reps' calls over the last seven days
