Feature: Status Report authoring
  Status Reporting should keep report production separate from portfolio dashboard presentation.

  Scenario: The Status Report page focuses on producing the report
    Given the deployed AMO Test application
    When I open the application
    And I open Status Report
    Then the Status Report authoring page should be displayed
    And the Status Report authoring page should not contain dashboard portfolio metrics
