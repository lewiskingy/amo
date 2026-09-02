Feature: Status Report authoring and viewing
  Status Reporting should keep report production separate from portfolio dashboard presentation
  and use one consistent renderer for preview, published viewing and scoped report content.

  Scenario: The Status Report page focuses on producing the report
    Given the deployed AMO Test application
    When I open the application
    And I open Status Report
    Then the Status Report authoring page should be displayed
    And the Status Report authoring page should not contain dashboard portfolio metrics

  Scenario: The Status Report page provides direct access to the latest published report
    Given the deployed AMO Test application
    When I open the application
    And I open Status Report
    And I prepare the Status Report acceptance fixture
    And I present the acceptance fixture as the latest published report
    Then the Latest Report card should show its published date and direct report actions

  Scenario: Draft Preview uses the shared report presentation and can open standalone
    Given the deployed AMO Test application
    When I open the application
    And I prepare the Status Report acceptance fixture
    And I preview the acceptance Status Report draft
    Then the Status Report modal should use the shared report renderer
    And the report should show portfolio sections and strong Health semantics
    And the report viewer should not expose removed report actions
    And Draft Preview should expose one Open Report action
    And Draft Open Report should target a temporary standalone preview

  Scenario: Published View uses the shared report presentation with one Open Report action
    Given the deployed AMO Test application
    When I open the application
    And I prepare the Status Report acceptance fixture
    And I view the acceptance Status Report as Published
    Then the Status Report modal should use the shared report renderer
    And the report should show portfolio sections and strong Health semantics
    And the report viewer should not expose removed report actions
    And Published View should expose one Open Report action
    And Open Report should target the canonical report route

  Scenario: Preview and View modal scope is independent from the page scope
    Given the deployed AMO Test application
    When I open the application
    And I prepare the Status Report acceptance fixture
    And the application page scope is Department Beta
    And I view the acceptance Status Report as Published
    Then the modal report scope should start organisation-wide
    When I scope the modal report to Department Alpha and Team Alpha One
    Then the modal report should contain only Demand Alpha
    And the application page scope should remain Department Beta

  Scenario: Historical report scope is projected from the persisted report snapshot
    Given the deployed AMO Test application
    When I open the application
    And I prepare the Status Report acceptance fixture
    And I render the acceptance report for the whole organisation
    Then the scoped report should contain Demand Alpha and Demand Beta
    When I render the acceptance report for Department Alpha
    Then the scoped report should contain Demand Alpha but not Demand Beta
    When I render the acceptance report for Team Alpha One
    Then the scoped report should contain only Demand Alpha
    And the scoped report should use the persisted Team Alpha One dashboard snapshot

  Scenario: Draft and Published presentations preserve the same report content
    Given the deployed AMO Test application
    When I open the application
    And I prepare the Status Report acceptance fixture
    And I render the acceptance report as Draft Preview
    Then I remember the acceptance report content
    When I render the acceptance report as Published
    Then the acceptance report content should match the Draft Preview

  Scenario: The standalone report route remains a report-only viewer
    Given the deployed AMO Test application
    When I open the standalone acceptance report route
    Then the standalone report viewer shell should be displayed
    And the standalone report viewer should not expose removed report actions
