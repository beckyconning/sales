Feature: Making notes about sales calls

    As a sales rep
    I want to make notes about sales calls and share them with my manager
    So that they will know the best leads to put me on and I can prepare for future calls

    Scenario: Make a note about a call
        When I access my call notes
        And make a new call note
        And provide my customer's name
        And provide some written notes about the call
        And provide a rating of my positivity about about the call
        And save the call note
        Then I should be presented with a confirmation that the call note was made
        And I should be presented with a list of my call notes
        When I access the call note I created
        Then I should be presented with all the information I provided
