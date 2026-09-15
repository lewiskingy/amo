Feature: Canonical Demand route
  The strategic Demand client should be available as the canonical /demand experience after cutover from the legacy implementation.

  Scenario: Target Demand shell is available
    Given the deployed AMO Test application
    When I open the Demand route
    Then the target Demand shell should be displayed
    And the deployed Demand route should connect to Remote Workspace
    And the Demand loading state should be cleared
    And the target navigation should show version, account and workspace context
    And the legacy Demand view should not be the rendered page

  Scenario: Demand deep links and search interaction survive route rendering
    Given the deployed AMO Test application
    When I open the Demand route for control "work-item-missing"
    Then the deployed Demand route should connect to Remote Workspace
    And the Demand control filter should be "work-item-missing"
    When I type "architecture" into the Demand search filter
    Then the Demand search should apply after a short pause and retain keyboard focus
