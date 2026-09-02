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

  Scenario: Users and application access are integrated with People
    Given the deployed AMO Test application
    When I open the application
    Then Users & Access should be available under Administration
    When I open Users & Access
    Then the Users & Access page should be displayed
    And the user administration surface should expose identity, access and status information
    When I open People
    Then People should expose AMO access separately from the Person record
    And People should provide a Manage Users & Access action
    When I choose Manage Users & Access
    Then the Users & Access page should be displayed
