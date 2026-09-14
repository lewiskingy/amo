Feature: Dark-launched Demand route
  The strategic Demand client should be independently reachable without replacing the legacy Demand navigation until parity is proven.

  Scenario: Target Demand shell is available
    Given the deployed AMO Test application
    When I open the dark-launched Demand route
    Then the target Demand shell should be displayed
    And the deployed Demand route should connect to Remote Workspace
    And the Demand loading state should be cleared
    And the target navigation should show version, account and workspace context
    And the Demand route should identify itself as a dark launch
    And the legacy Demand view should not be the rendered page

  Scenario: Demand deep links and search interaction survive route rendering
    Given the deployed AMO Test application
    When I open the dark-launched Demand route for control "work-item-missing"
    Then the deployed Demand route should connect to Remote Workspace
    And the Demand control filter should be "work-item-missing"
    When I type "architecture" into the Demand search filter
    Then the Demand search should apply after a short pause and retain keyboard focus
