Feature: Dark-launched Demand route
  The strategic Demand client should be independently reachable without replacing the legacy Demand navigation until parity is proven.

  Scenario: Target Demand shell is available
    Given the deployed AMO Test application
    When I open the dark-launched Demand route
    Then the target Demand shell should be displayed
    And the Demand route should identify itself as a dark launch
    And the legacy Demand view should not be the rendered page
