package services

import (
	"omnimail/internal/apperr"
	"omnimail/internal/contacts"
	"omnimail/internal/profilemgr"
)

func (s *ContactService) requireContactProfile(profileID string) (*profilemgr.Session, error) {
	sess, err := s.mgr.ActiveSession()
	if err != nil {
		return nil, err
	}
	if profileID == "" || sess.Meta.ID != profileID {
		return nil, apperr.New(apperr.CodeInvalidInput, "工作空间已切换，请重新打开通讯录")
	}
	return sess, nil
}

func (s *ContactService) FindDuplicateContacts(profileID string) ([]contacts.DuplicateGroupDTO, error) {
	sess, err := s.requireContactProfile(profileID)
	if err != nil {
		return nil, err
	}
	return contacts.FindDuplicateContacts(sess.DB)
}

func (s *ContactService) ListContactsForProfile(profileID string) ([]contacts.ContactItemDTO, error) {
	sess, err := s.requireContactProfile(profileID)
	if err != nil {
		return nil, err
	}
	return contacts.ListContacts(sess.DB, contacts.ContactQuery{})
}

func (s *ContactService) BatchMergeContacts(profileID string, plans []contacts.ContactMergeGroup) (contacts.ContactMergeResult, error) {
	sess, err := s.requireContactProfile(profileID)
	if err != nil {
		return contacts.ContactMergeResult{}, err
	}
	return contacts.BatchMergeContacts(sess.DB, plans)
}

func (s *ContactService) IgnoreDuplicateContacts(profileID, groupKey string) error {
	sess, err := s.requireContactProfile(profileID)
	if err != nil {
		return err
	}
	return contacts.IgnoreDuplicateContacts(sess.DB, groupKey)
}

func (s *ContactService) ListContactMailHistory(profileID, contactID, cursor string) (contacts.ContactMailPage, error) {
	sess, err := s.requireContactProfile(profileID)
	if err != nil {
		return contacts.ContactMailPage{}, err
	}
	return contacts.ListContactMailHistory(sess.DB, contactID, cursor)
}
