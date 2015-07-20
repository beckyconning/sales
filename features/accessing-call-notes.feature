Feature: Accessing notes about sales calls

    As a sales rep
    I want to access my notes about past sales calls
    So that I can prepare for future sales calls

    Scenario: Access list of notes
        When I access my call notes
        Then I should be presented with the customer names of my calls
        And I should be presented with my positivity about my calls
        And I should be presented with the dates of my calls

    Scenario: Access a note
        When I access my call notes
        Then I should be presented with a list of my call notes
        When I access a specific note
        Then I should be presented with the customer's name
        And I should be presented with some written notes about the call
        And should be presented with a rating of my positivity about about the call
