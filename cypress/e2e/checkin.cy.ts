describe('Check-in with anomaly detection', () => {
  beforeEach(() => cy.login('admin@campusbuzz.com', 'Admin@123'));

  it('shows manual input when camera denied', () => {
    cy.visit('/dashboard/scanner');
    cy.get('[data-testid="manual-input"]').should('be.visible');
  });

  it('shows green card for normal check-in', () => {
    cy.visit('/dashboard/scanner');
    cy.get('[data-testid="manual-input"]').type('CP-VALIDREGISTRATIONID');
    cy.get('[data-testid="manual-submit"]').click();
    cy.get('[data-testid="checkin-success"]').should('be.visible');
    cy.get('[data-testid="anomaly-score"]').should('exist');
  });

  it('shows flagged check-ins on /dashboard/flagged', () => {
    cy.visit('/dashboard/flagged');
    cy.get('[data-testid="flagged-table"]').should('exist');
  });

  it('admin can override a flagged check-in', () => {
    cy.visit('/dashboard/flagged');
    cy.get('[data-testid="override-btn"]').first().click();
    cy.get('[data-testid="success-toast"]').should('be.visible');
  });
});
