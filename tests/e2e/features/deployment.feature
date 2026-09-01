Feature: Deployed AMO release integrity
  The Test environment should prove the exact client and backend release before it can be promoted.

  Scenario: The public Test hostname serves the deployed release
    Given the deployed AMO Test application
    When I open the application
    Then the public hostname should identify itself as the Test application
    And the client version should match the deployed candidate
    And the backend version and API contract should match the deployed candidate

  Scenario: The application shell remains coherent
    Given the deployed AMO Test application
    When I open the application
    Then the navigation shell should be usable at the selected viewport
    And there should be one account identity surface
    And the legacy command menu should not be present
